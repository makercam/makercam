import * as maker from 'makerjs'
import * as sax from 'sax'
import * as shape2path from 'shape2path'

import angusOffset from './angusOffset'
import clipperOffset from './clipperOffset'

export interface Make {
    $: typeof maker.$
    cloneObject: typeof maker.cloneObject
    createRouteKey: typeof maker.createRouteKey
    extendObject: typeof maker.extendObject
    isChain: typeof maker.isChain
    isFunction: typeof maker.isFunction
    isModel: typeof maker.isModel
    isNumber: typeof maker.isNumber
    isObject: typeof maker.isObject
    isPath: typeof maker.isPath
    isPathArc: typeof maker.isPathArc
    isPathArcInBezierCurve: typeof maker.isPathArcInBezierCurve
    isPathCircle: typeof maker.isPathCircle
    isPathLine: typeof maker.isPathLine
    isPoint: typeof maker.isPoint
    round: typeof maker.round
    splitDecimal: typeof maker.splitDecimal
    travel: typeof maker.travel
    addCaption: typeof maker.model.addCaption
    addModel: typeof maker.model.addModel
    addPath: typeof maker.model.addPath
    addTo: typeof maker.model.addTo
    breakPathsAtIntersections: typeof maker.model.breakPathsAtIntersections
    center: typeof maker.model.center
    clone: typeof maker.model.clone
    combine: typeof maker.model.combine
    intersection: typeof maker.model.combineIntersection
    combineIntersection: typeof maker.model.combineIntersection
    difference: typeof maker.model.combineSubtraction
    combineSubtraction: typeof maker.model.combineSubtraction
    union: typeof maker.model.combineUnion
    combineUnion: typeof maker.model.combineUnion
    convertUnits: typeof maker.model.convertUnits
    countChildModels: typeof maker.model.countChildModels
    distort: typeof maker.model.distort
    expandPaths: typeof maker.model.expandPaths
    findChains: typeof maker.model.findChains
    findSingleChain: typeof maker.model.findSingleChain
    getAllCaptionsOffset: typeof maker.model.getAllCaptionsOffset
    getSimilarModelId: typeof maker.model.getSimilarModelId
    getSimilarPathId: typeof maker.model.getSimilarPathId
    isPathInsideModel: typeof maker.model.isPathInsideModel
    layer: typeof maker.model.layer
    mirror: typeof maker.model.mirror
    move: typeof maker.model.move
    moveRelative: typeof maker.model.moveRelative
    originate: typeof maker.model.originate
    outline: typeof maker.model.outline
    prefixPathIds: typeof maker.model.prefixPathIds
    removeDeadEnds: typeof maker.model.removeDeadEnds
    rotate: typeof maker.model.rotate
    scale: typeof maker.model.scale
    simplify: typeof maker.model.simplify
    walk: typeof maker.model.walk
    walkPaths: typeof maker.model.walkPaths
    zero: typeof maker.model.zero
    ellipse: typeof maker.models.Ellipse.constructor
    offset: (modelToOutline: maker.IModel, offset: number, joints?: number) => maker.IModel
    clipperOffset: (modelToOutline: maker.IModel, offset: number, joints?: number, tolerance?: number) => maker.IModel
    angusOffset: (modelToOutline: maker.IModel, offset: number, joints?: number) => maker.IModel
    raster: (modelToRasterize: maker.IModel, margin: number, offset?: number) => maker.IModel
    toKeyPoints: (drawing: maker.IModel, tolerance?: number) => maker.IPoint[]
    fromSvg(svg: string): maker.IModel
    view: (model: maker.IModel, containerEl?: HTMLElement) => void,
    models: (...args: maker.IModel[]) => maker.IModel
}

const make: Make = {
    addCaption: maker.model.addCaption,
    addModel: maker.model.addModel,
    addPath: maker.model.addPath,
    addTo: maker.model.addTo,
    breakPathsAtIntersections: maker.model.breakPathsAtIntersections,
    center: maker.model.center,
    clone: maker.model.clone,
    combine: maker.model.combine,
    intersection: maker.model.combineIntersection,
    combineIntersection: maker.model.combineIntersection,
    difference: maker.model.combineSubtraction,
    combineSubtraction: maker.model.combineSubtraction,
    union: maker.model.combineUnion,
    combineUnion: maker.model.combineUnion,
    convertUnits: maker.model.convertUnits,
    countChildModels: maker.model.countChildModels,
    distort: maker.model.distort,
    expandPaths: maker.model.expandPaths,
    findChains: maker.model.findChains,
    findSingleChain: maker.model.findSingleChain,
    getAllCaptionsOffset: maker.model.getAllCaptionsOffset,
    getSimilarModelId: maker.model.getSimilarModelId,
    getSimilarPathId: maker.model.getSimilarPathId,
    isPathInsideModel: maker.model.isPathInsideModel,
    layer: maker.model.layer,
    mirror: maker.model.mirror,
    move: maker.model.move,
    moveRelative: maker.model.moveRelative,
    originate: maker.model.originate,
    outline: maker.model.outline,
    prefixPathIds: maker.model.prefixPathIds,
    removeDeadEnds: maker.model.removeDeadEnds,
    rotate: maker.model.rotate,
    scale: maker.model.scale,
    simplify: maker.model.simplify,
    walk: maker.model.walk,
    walkPaths: maker.model.walkPaths,
    zero: maker.model.zero,
    ...maker,
    ...(Object.keys(maker.models).reduce((memo: any, modelName: string) => {
        const lcFirstModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        // @ts-ignore
        memo[lcFirstModelName] = (...args: any[]) => new maker.models[modelName](...args)
        return memo
    }, {})),
    raster: (modelToRasterize: maker.IModel, margin: number, offset: number = 0) => {
        var measurement = maker.measure.modelExtents(modelToRasterize);
        if (!measurement) {
            return {}
        }
        var line = new maker.paths.Line([0, 0], [measurement.width + 2, 0]);
        var count = Math.ceil(measurement.height / margin)
        var lines = maker.layout.cloneToColumn(line, count, margin);
        lines.origin = maker.point.subtract(measurement.low, [1, 0])
        if (offset) {
            maker.model.moveRelative(lines, [0, offset]);
        }
        var clone = maker.cloneObject(modelToRasterize)
        maker.model.combine(clone, lines, true, true, true, false, {
            pointMatchingDistance: .00001,
        });
        Object.values(lines.paths || {}).forEach((path: any, i: number) => {
            if (i % 2 === 0) {
                const originalOrigin = path.origin
                path.origin = path.end
                path.end = originalOrigin
            }
        })
        return lines
    },
    offset: (modelToOutline: maker.IModel, offset: number, joints: number = 0) => {
        return maker.model.outline(modelToOutline, Math.abs(offset), joints, offset < 0)
    },
    clipperOffset: (modelToOutline: maker.IModel, offset: number, joints: number = 0, tolerance?: number) => {
        return clipperOffset(modelToOutline, offset, joints, tolerance)
    },
    angusOffset: (modelToOutline: maker.IModel, offset: number, joints: number = 0) => {
        return angusOffset(modelToOutline, offset, joints)
    },
    toPoints(drawing: maker.IModel, tolerance: number = 0.1) {
        var chain = maker.model.findSingleChain(drawing);
        var minimumSpacing = tolerance;
        var divisions = Math.floor(chain.pathLength / minimumSpacing);
        var spacing = chain.pathLength / divisions;
        var points = maker.chain.toPoints(chain, spacing);
        return points
    },
    toKeyPoints(drawing: maker.IModel, tolerance: number = 0.1) {
        var chain = maker.model.findSingleChain(drawing);
        var minimumSpacing = tolerance;
        var divisions = Math.floor(chain.pathLength / minimumSpacing);
        var spacing = chain.pathLength / divisions;
        var keyPoints = maker.chain.toKeyPoints(chain, spacing);
        if (chain.endless) {
            keyPoints.push(keyPoints[0])
        }
        return keyPoints
    },
    view(model: maker.IModel, containerEl?: HTMLElement) {
        (containerEl || document.body).innerHTML = maker.exporter.toSVG(model)
    },
    models(...args: maker.IModel[]) {
        return {
            models: args.reduce((memo, model, i) => {
                // @ts-ignore
                memo[i] = model
                return memo
            }, {})
        }
    },
    fromSvg(svg: string): maker.IModel {
        const parser = sax.parser(false, {trim: true, lowercase: false, position: true})
        parser.onerror = (e: any) => console.log('error: line ' + e.line + ', column ' + e.column + ', bad character [' + e.c + ']')
        const models: any = {}
        const counts = {
            ellipses: 0,
            rectangles: 0,
            circles: 0,
            lines: 0,
            paths: 0
        }
        parser.onopentag = function (node: any) {
            switch (node.name) {
                case 'ELLIPSE':
                    models['ellipse_' + counts.ellipses] = maker.importer.fromSVGPathData(shape2path.ellipse({
                        cx: Number(node.attributes.CX),
                        cy: Number(node.attributes.CY),
                        rx: Number(node.attributes.RX),
                        ry: Number(node.attributes.RY),
                    }))
                    counts.ellipses++
                    break;
                case 'CIRCLE':
                    models['circle_' + counts.circles] = maker.importer.fromSVGPathData(shape2path.circle({
                        cx: Number(node.attributes.CX),
                        cy: Number(node.attributes.CY),
                        r: Number(node.attributes.R)
                    }))
                    counts.circles++
                    break;
                case 'RECT':
                    models['rect_' + counts.rectangles] = maker.importer.fromSVGPathData(shape2path.rect({
                        x: Number(node.attributes.X),
                        y: Number(node.attributes.Y),
                        width: Number(node.attributes.WIDTH),
                        height: Number(node.attributes.HEIGHT),
                    }))
                    counts.rectangles++
                    break;
                case 'LINE':
                    models['line_' + counts.lines] = maker.importer.fromSVGPathData(shape2path.line({
                        x1: Number(node.attributes.X1),
                        x2: Number(node.attributes.X2),
                        y1: Number(node.attributes.Y1),
                        y2: Number(node.attributes.Y2),
                    }))
                    counts.lines++
                    break;
                case 'PATH':
                    models['path_' + counts.paths] = maker.importer.fromSVGPathData(node.attributes.D)
                    counts.paths++
                    break;
            }
        }
        parser.write(svg).close()
        return {
            models
        } as maker.IModel
    }
}

export default make