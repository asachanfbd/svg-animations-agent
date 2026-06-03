(function(window) {
    class EventEmitter {
        constructor() {
            this.listeners = {};
        }
        on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        }
        emit(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(cb => cb(data));
            }
        }
    }

    class Layer extends EventEmitter {
        constructor(id, elementId, manager) {
            super();
            this.id = id;
            this.element = document.querySelector(elementId);
            this.manager = manager;
            this.isActive = false;
            
            this.sequence = [];
            this.currentStepIndex = 0;
            this.stepTimeElapsed = 0;
            this.loop = false;
            
            // Persistent state across frames
            this.state = {};
        }
        
        setSequence(sequence, loop = false) {
            this.sequence = sequence;
            this.loop = loop;
            return this;
        }
        
        setCustomUpdate(fn) {
            this.customUpdate = fn;
            return this;
        }
        
        start() {
            if (this.sequence.length === 0 && !this.customUpdate) return;
            this.isActive = true;
            this.currentStepIndex = 0;
            this.stepTimeElapsed = 0;
            this.emit('start', this);
        }
        
        stop() {
            this.isActive = false;
            this.emit('end', this);
        }
        
        applyState() {
            if (this.state.opacity !== undefined) {
                this.element.style.opacity = this.state.opacity;
            }
            
            let transformParts = [];
            
            if (this.state.x !== undefined || this.state.y !== undefined) {
                const x = this.state.x || 0;
                const y = this.state.y || 0;
                transformParts.push(`translate(${x}, ${y})`);
            }
            if (this.state.rotate !== undefined) {
                transformParts.push(`rotate(${this.state.rotate})`);
            }
            if (this.state.scaleX !== undefined || this.state.scaleY !== undefined) {
                const sx = this.state.scaleX !== undefined ? this.state.scaleX : 1;
                const sy = this.state.scaleY !== undefined ? this.state.scaleY : 1;
                transformParts.push(`scale(${sx}, ${sy})`);
            }
            
            if (transformParts.length > 0) {
                this.element.setAttribute('transform', transformParts.join(' '));
            }
        }
        
        update(deltaTime, svgRect) {
            if (!this.isActive) return;
            
            if (this.customUpdate) {
                this.customUpdate(this, deltaTime, svgRect);
                return;
            }
            
            if (this.currentStepIndex >= this.sequence.length) {
                if (this.loop) {
                    this.currentStepIndex = 0;
                    this.stepTimeElapsed = 0;
                } else {
                    this.stop();
                    return;
                }
            }
            
            const step = this.sequence[this.currentStepIndex];
            
            if (step.type === 'emit') {
                this.emit(step.event, this);
                this.currentStepIndex++;
                this.update(0, svgRect);
                return;
            }
            
            if (step.type === 'trigger') {
                const targetLayer = this.manager.getLayer(step.target);
                if (targetLayer) targetLayer.start();
                this.currentStepIndex++;
                this.update(0, svgRect);
                return;
            }
            
            this.stepTimeElapsed += deltaTime;
            let progress = step.duration ? Math.min(1, this.stepTimeElapsed / step.duration) : 1;
            
            if (step.animations && Array.isArray(step.animations)) {
                step.animations.forEach(anim => {
                    this.manager.executeAnimation(anim.type, this, progress, svgRect, anim);
                });
            } else if (step.type) {
                this.manager.executeAnimation(step.type, this, progress, svgRect, step);
            }
            
            this.applyState();
            
            if (progress >= 1) {
                this.currentStepIndex++;
                this.stepTimeElapsed = 0;
            }
        }
    }

    class AnimationManager {
        constructor(svgId) {
            this.svg = document.getElementById(svgId);
            this.layers = {};
            this.animations = {};
            this.lastTime = performance.now();
            this.tick = this.tick.bind(this);
            
            this.registerStandardAnimations();
        }
        
        registerStandardAnimations() {
            // Helpers extended to support percentages and custom coordinates
            const getX = (val, svgRect) => {
                const radius = 25; 
                const padding = 30;
                if (val === 'left') return radius + padding;
                if (val === 'right') return svgRect.width - radius - padding;
                if (typeof val === 'string' && val.endsWith('%')) {
                    return (parseFloat(val) / 100) * svgRect.width;
                }
                if (typeof val === 'number') return val;
                return radius + padding; // default left
            };
            
            const getY = (val, svgRect) => {
                const radius = 25; 
                const padding = 30;
                if (val === 'top') return radius + padding;
                if (val === 'bottom') return svgRect.height - radius - padding;
                if (typeof val === 'string' && val.endsWith('%')) {
                    return (parseFloat(val) / 100) * svgRect.height;
                }
                if (typeof val === 'number') return val;
                return radius + padding; // default top
            };
            
            this.registerAnimation('move', (layer, progress, svgRect, config) => {
                const sX = getX(config.startX !== undefined ? config.startX : 'left', svgRect);
                const eX = getX(config.endX !== undefined ? config.endX : sX, svgRect);
                
                const sY = getY(config.startY !== undefined ? config.startY : 'top', svgRect);
                const eY = getY(config.endY !== undefined ? config.endY : sY, svgRect);
                
                layer.state.x = sX + progress * (eX - sX);
                layer.state.y = sY + progress * (eY - sY);
            });
            
            this.registerAnimation('fade', (layer, progress, svgRect, config) => {
                const sOp = config.startOpacity !== undefined ? config.startOpacity : 1;
                const eOp = config.endOpacity !== undefined ? config.endOpacity : sOp;
                layer.state.opacity = sOp + progress * (eOp - sOp);
            });
            
            this.registerAnimation('scale', (layer, progress, svgRect, config) => {
                const sSX = config.startScale !== undefined ? config.startScale : (config.startScaleX !== undefined ? config.startScaleX : 1);
                const eSX = config.endScale !== undefined ? config.endScale : (config.endScaleX !== undefined ? config.endScaleX : sSX);
                
                const sSY = config.startScale !== undefined ? config.startScale : (config.startScaleY !== undefined ? config.startScaleY : 1);
                const eSY = config.endScale !== undefined ? config.endScale : (config.endScaleY !== undefined ? config.endScaleY : sSY);
                
                layer.state.scaleX = sSX + progress * (eSX - sSX);
                layer.state.scaleY = sSY + progress * (eSY - sSY);
            });
            
            this.registerAnimation('rotate', (layer, progress, svgRect, config) => {
                const sA = config.startAngle !== undefined ? config.startAngle : 0;
                const eA = config.endAngle !== undefined ? config.endAngle : sA;
                
                layer.state.rotate = sA + progress * (eA - sA);
            });
            
            this.registerAnimation('type', (layer, progress, svgRect, config) => {
                if (typeof config.text === 'string') {
                    const textLength = config.text.length;
                    const currentLength = Math.floor(progress * textLength);
                    layer.element.textContent = config.text.substring(0, currentLength);
                }
            });
        }
        
        registerAnimation(name, fn) {
            this.animations[name] = fn;
        }
        
        executeAnimation(name, layer, progress, svgRect, config) {
            const fn = this.animations[name];
            if (fn) {
                fn(layer, progress, svgRect, config);
            } else {
                console.warn(`Animation ${name} not found`);
            }
        }
        
        createLayer(id, elementId) {
            const layer = new Layer(id, elementId, this);
            this.layers[id] = layer;
            return layer;
        }
        
        getLayer(id) {
            return this.layers[id];
        }
        
        start() {
            this.lastTime = performance.now();
            requestAnimationFrame(this.tick);
        }
        
        tick(currentTime) {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            // Derive rendering coordinates based on internal viewBox if available for true proportional scaling
            let svgRect;
            if (this.svg.viewBox && this.svg.viewBox.baseVal && this.svg.viewBox.baseVal.width > 0) {
                svgRect = {
                    width: this.svg.viewBox.baseVal.width,
                    height: this.svg.viewBox.baseVal.height
                };
            } else {
                svgRect = this.svg.getBoundingClientRect();
            }
            
            Object.values(this.layers).forEach(layer => {
                layer.update(deltaTime, svgRect);
            });
            
            requestAnimationFrame(this.tick);
        }
    }

    // Attach to global window
    window.AnimationManager = AnimationManager;
    
})(window);
