import SVGAMovieEntity from './SVGAMovieEntity'
import SVGALayerFrameEntity from './SVGALayerFrameEntity'
import Matrix from './transformation-matrix'
import SVGAPathHelper from './SVGAPathHelper'
import SVGAShapeHelper from './SVGAShapeHelper'
import SVGAMaskHelper from './SVGAMaskHelper'

module.exports = class SVGATimeline {

    _movie = null;
    _frames = [];
    _resources = {};

    constructor() {
        this._movie = new SVGAMovieEntity();
    }

    readFrame = (idx) => {
        this._orderCurrent = 0;
        let layerFrames = this.findLayerFrames(stage);
        this._frames.push(layerFrames);
    };

    resetOrders = () => {
        let orderStack = [];
        let orderStackIdelIndex = (imageKey) => {
            for (let index = 0; index < orderStack.length; index++) {
                let element = orderStack[index];
                if (element.imageKey === imageKey && element.used === false) {
                    return index;
                }
            }
            return null;
        }
        for (let frameIdx = 0; frameIdx < this._frames.length; frameIdx++) {
            let spriteLayers = this._frames[frameIdx];
            for (let index = 0; index < orderStack.length; index++) {
                let element = orderStack[index];
                element.used = false;
            }
            for (let layerIdx = 0; layerIdx < spriteLayers.length; layerIdx++) {
                let spriteLayer = spriteLayers[layerIdx];
                let idelIndex = orderStackIdelIndex(spriteLayer.imageKey);
                if (idelIndex === null) {
                    let insertIdx = null;
                    for (let layerIdx = 0; layerIdx < spriteLayers.length; layerIdx++) {
                        let spriteLayer = spriteLayers[layerIdx];
                        let idelIndex = orderStackIdelIndex(spriteLayer.imageKey);
                        if (idelIndex !== null) {
                            insertIdx = idelIndex;
                            break;
                        }
                    }
                    if (insertIdx === null) {
                        orderStack.push({imageKey: spriteLayer.imageKey, used: true});
                    }
                    else {
                        orderStack.splice(insertIdx, 0, {imageKey: spriteLayer.imageKey, used: true});
                    }
                }
                else {
                    orderStack[idelIndex].used = true;
                }
            }
        }
        for (let frameIdx = 0; frameIdx < this._frames.length; frameIdx++) {
            let spriteLayers = this._frames[frameIdx];
            for (let index = 0; index < orderStack.length; index++) {
                let element = orderStack[index];
                element.used = false;
            }
            for (let layerIdx = 0; layerIdx < spriteLayers.length; layerIdx++) {
                let spriteLayer = spriteLayers[layerIdx];
                let idelIndex = orderStackIdelIndex(spriteLayer.imageKey);
                if (idelIndex != null) {
                    spriteLayer.layerOrder = idelIndex;
                    orderStack[idelIndex].used = true;
                }
            }
        }
    }

    findLayerFrames = (layer) => {
        let layers = [];
        if (layer.children instanceof Array) {
            for (let index = 0; index < layer.children.length; index++) {
                let elementLayers = this.findLayerFrames(layer.children[index]);
                for (let index = 0; index < elementLayers.length; index++) {
                    layers.push(elementLayers[index]);
                }
            }
        }
        else {
            layers.push(this.parseLayerFrame(layer));
        }
        return layers;
    }

    parseLayerFrame = (layer) => {
        let layerFrame = new SVGALayerFrameEntity();
        if (layer.image instanceof Node) {
            let imageKey = layer.image.src.toString().split('/').pop().replace('.png', '').split('?')[0];
            if (imageKey.match(/[^a-zA-Z0-9\.\-\_]/) !== null) {
                imageKey = md5(imageKey);
            }
            let image = {
                imageKey: imageKey,
                dataPath: layer.image.src.toString(),
            }
            layerFrame.imageKey = image.imageKey;
            if (this._resources[image.imageKey] === undefined) {
                this._resources[image.imageKey] = image;
            }
            layerFrame.layout.x = layer.getBounds().x;
            layerFrame.layout.y = layer.getBounds().y;
            layerFrame.layout.width = layer.getBounds().width;
            layerFrame.layout.height = layer.getBounds().height;
        }
        else if (layer.graphics !== undefined && layer.graphics !== null) {
            layerFrame.imageKey = layer.id + ".vector";
            let shape = {
                type: "shape",
                args: {
                    d: (new SVGAPathHelper(layer.graphics)).requestPath(),
                },
                styles: (new SVGAShapeHelper(layer.graphics)).requestStyle(),
            }
            layerFrame.shapes.push(shape);
        }
        layerFrame.alpha = layer.alpha;
        let matrix = new Matrix();
        matrix.translate(-layer.regX, -layer.regY).scale(layer.scaleX, layer.scaleY).rotate(-layer.rotation * Math.PI / 180);
        matrix.translate(layer.x, layer.y);
        let currentParnet = layer.parent;
        while (currentParnet != null && currentParnet != undefined) {
            matrix.translate(-currentParnet.regX, -currentParnet.regY).scale(currentParnet.scaleX, currentParnet.scaleY).rotate(-currentParnet.rotation * Math.PI / 180);
            matrix.translate(currentParnet.x, currentParnet.y);
            currentParnet = currentParnet.parent;
        }
        layerFrame.transform.a = matrix.props[0];
        layerFrame.transform.b = matrix.props[1];
        layerFrame.transform.c = matrix.props[4];
        layerFrame.transform.d = matrix.props[5];
        layerFrame.transform.tx = matrix.props[12];
        layerFrame.transform.ty = matrix.props[13];
        layerFrame.clipPath = (new SVGAMaskHelper(layer)).requestMaskPath();
        return layerFrame;
    }

    combined = () => {
        let sprites = {};
        for (let frameIdx = 0; frameIdx < this._frames.length; frameIdx++) {
            let frameSprites = this._frames[frameIdx];
            for (let layerIdx = 0; layerIdx < frameSprites.length; layerIdx++) {
                let frameSprite = frameSprites[layerIdx];
                if (sprites[frameSprite.layerOrder] === undefined) {
                    sprites[frameSprite.layerOrder] = [];
                    for (let index = 0; index < frameIdx; index++) {
                        sprites[frameSprite.layerOrder].push({});
                    }
                }
                if (frameSprite.alpha <= 0.0) {
                    sprites[frameSprite.layerOrder].push({});
                }
                else {
                    sprites[frameSprite.layerOrder].push(frameSprite);
                }
            }
            for (var spriteKey in sprites) {
                if (sprites.hasOwnProperty(spriteKey)) {
                    var element = sprites[spriteKey];
                    if (element.length - 1 < frameIdx) {
                        element.push({});
                    }
                }
            }
        }
        trim = (sprites) => {
            let hasTrimmed = false;
            let targetA = null;
            let targetB = null;
            for (var aKey in sprites) {
                if (sprites.hasOwnProperty(aKey)) {
                    var element = sprites[aKey];
                    if (hasTrimmed) {
                        return;
                    }
                    if (targetA === null) {
                        targetA = element;
                    }
                    else {
                        if (targetA.imageKey === element.imageKey) {
                            targetB = element;
                            for (let index = 0; index < this._movie.frameCount; index++) {
                                if (Object.keys(targetA[index]).length > 0 && Object.keys(targetB[index]).length > 0) {
                                    targetA = targetB;
                                    targetB = null;
                                    break;
                                }
                            }
                            // combine now
                            if (targetA == null || targetB == null) {
                                continue;
                            }
                            for (let index = 0; index < this._movie.frameCount; index++) {
                                if (Object.keys(targetB[index]).length > 0) {
                                    targetA[index] = targetB[index];
                                }
                            }
                            delete sprites[aKey];
                            hasTrimmed = true;
                            break;
                        }
                        else {
                            targetA = element;
                            targetB = null;
                        }
                    }
                }
            }
            return hasTrimmed
        }
        while(trim(sprites)) {}
        return sprites;
    }

}