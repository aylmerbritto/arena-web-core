/* global AFRAME */

/**
 * @fileoverview Component loads/unloads gltfs by simple user distance-based LOD
 * Inspired by aframe-lod <https://github.com/mflux/aframe-lod>
 *
 */

const LOD_THRESHOLD = 1;

AFRAME.registerComponent('gltf-lod-advanced', {
    schema: {
        updateRate: {type: 'number', default: 333},
        fade: {type: 'number', default: 0},
    },
    init: function() {
        this.camDistance = new THREE.Vector3();
        this.tempDistance = new THREE.Vector3();
        this.currentLevel = undefined;
        this.cameraPos = document.getElementById('my-camera').object3D.position;

        this.tick = AFRAME.utils.throttleTick(this.tick, this.data.updateRate, this);
        this.updateLevels();
    },
    updateLevels: function() {
        this.levels = Array.from(this.el.children).filter((child) => child.hasAttribute('lod-level'));
        // Sort desc by distance
        this.levels.sort((a, b) => b.getAttribute('lod-level').distance - a.getAttribute('lod-level').distance);
        for (const level of this.levels) {
            if (level !== this.currentLevel) {
                level.object3D.visible = false;
            }
        }
    },
    tick: function() {
        this.tempDistance = this.cameraPos.distanceTo(this.el.object3D.position);
        if (this.tempDistance !== this.camDistance) {
            this.camDistance = this.tempDistance;
            let nextLevel;
            for (const level of this.levels) {
                if (this.camDistance <= level.getAttribute('lod-level').distance) {
                    nextLevel = level;
                } else {
                    break;
                }
            }
            if (nextLevel && nextLevel !== this.currentLevel) {
                // Hide previous. TODO: Fade out animation, then unload
                if (this.currentLevel) {
                    const cacheKey = this.currentLevel.getAttribute('gltf-model');
                    this.currentLevel.object3D.visible = false;
                    this.currentLevel.removeAttribute('gltf-model', false);
                    /* TODO: Add a buffer range or delay from unloading to avoid janky
                        behavior from jitter at threshold of two lod levels */
                    if (!nextLevel.components['lod-level']?.data.retainCache) {
                        THREE.Cache.remove(cacheKey);
                    }
                }
                // Show next
                const nextModel = nextLevel.getAttribute('lod-level')['gltf-model'];
                if (nextModel) {
                    nextLevel.setAttribute('gltf-model', nextModel);
                    nextLevel.object3D.visible = true;
                    if (this.data.fade) {
                        nextLevel.setAttribute('material', {transparent: true});
                        nextLevel.setAttribute('animation', {
                            property: 'components.material.material.opacity',
                            from: 0,
                            to: 1,
                            dur: this.data.fade,
                            startEvents: 'model_loaded',
                        });
                    }
                }
                this.currentLevel = nextLevel;
            }
        }
    },
});

AFRAME.registerComponent('lod-level', {
    schema: {
        'distance': {type: 'number', default: 10},
        'gltf-model': {type: 'string'},
        'retainCache': {type: 'boolean', default: false},
    },
    init: function() {
        const lodParent = this.el.parentEl.components['gltf-lod'];
        if (lodParent?.levels && !lodParent.levels.includes(this.el)) {
            lodParent.updateLevels();
        }
    },
});


/**
 * @brief Simple LOD swap between default (low) and detailed (high) models
 */
AFRAME.registerComponent('gltf-model-lod', {
    schema: {
        updateRate: {type: 'number', default: 333},
        retainCache: {type: 'boolean', default: false},
        detailedUrl: {type: 'string'},
        detailedDistance: {type: 'number', default: 10},
    },
    init: function() {
        this.camDistance = new THREE.Vector3();
        this.tempDistance = new THREE.Vector3();
        this.showDetailed = false;
        this.defaultUrl = this.el.getAttribute('gltf-model');
        this.cameraPos = document.getElementById('my-camera').object3D.position;
        this.tick = AFRAME.utils.throttleTick(this.tick, this.data.updateRate, this);
    },
    tick: function() {
        if (!this.defaultUrl) {
            return;
        }
        this.tempDistance = this.cameraPos.distanceTo(this.el.object3D.position);
        if (this.tempDistance !== this.camDistance) {
            this.camDistance = this.tempDistance;
            const distDiff = this.camDistance - this.data.detailedDistance;
            // Switch from default to detailed when inside (dist - threshold)
            if (!this.showDetailed && distDiff <= -LOD_THRESHOLD ) {
                this.el.setAttribute('gltf-model', this.data.detailedUrl);
                this.showDetailed = true;
            // Switch from detailed to default when outside (dist + threshold)
            } else if (this.showDetailed && distDiff >= LOD_THRESHOLD) {
                this.el.setAttribute('gltf-model', this.defaultUrl);
                this.showDetailed = false;
                if (!this.data.retainCache) {
                    THREE.Cache.remove(this.defaultUrl);
                }
            }
        }
    },
});
