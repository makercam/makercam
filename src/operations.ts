/// <reference path="./index.d.ts" />
import * as openjscam from '@makercam/openjscam'
import * as maker from 'makerjs'

import mk from './make'

export interface ITool {
    diameter: number
}

export interface IOperation {
    id?: string
    tool: ITool,
    zSafe: number,
    layers: string[]
}

export interface IPocketOperation extends IOperation {
    type: 'pocket'
    stockToLeave: number
    depth: number
    depthPerPass: number
}

export interface IContourOperation extends IOperation {
    type: 'contour'
    tolerance: number
    outside: boolean
    depth: number
    depthPerPass: number
}

export interface ITraceOperation extends IOperation {
    type: 'trace'
    tolerance: number
    depth: number
    depthPerPass: number
}

export type IAnyOperation = IPocketOperation | IContourOperation | ITraceOperation

export function trace(model: maker.IModel, depth: number, depthPerPass: number, zSafe: number, tolerance: number = 0.1) {
    const points = mk.toKeyPoints(model, tolerance)
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        openjscam.rapid({ x: points[0][0], y: points[0][1] })
        openjscam.cut({ z: -z })
        points.map((point) => {
            openjscam.cut({ x: point[0], y: point[1] })
        })
        openjscam.rapid({ z: zSafe })
    }
    return {
        models: {
            contour: model
        }
    }
}

export function pocket(model: maker.IModel, toolDiameter = 8, depth: number, depthPerPass: number, zSafe: number, stockToLeave: number = 0) {
    const toolRadius = toolDiameter / 2
    const inset = toolRadius + stockToLeave
    const insetted = new maker.models.ConnectTheDots(true, mk.toKeyPoints(mk.clipperOffset(model, -inset), 0.1)) 
    const raster = mk.raster(insetted, toolRadius)
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        Object.values(raster.paths || {}).forEach((path: any) => {
            openjscam.rapid({
                x: (path.origin ? path.origin[0] : 0) + (raster.origin ? raster.origin[0] : 0),
                y: (path.origin ? path.origin[1] : 0) + (raster.origin ? raster.origin[1] : 0),
            })
            openjscam.cut({ z: -z })
            openjscam.cut({
                x: path.end[0] + raster.origin![0],
                y: path.end[1] + raster.origin![1]
            })
            openjscam.rapid({ z: zSafe })
        })
    }
    return {
        models: {
            raster
        }
    }
}

export function contour(model: maker.IModel, toolDiameter = 8, outside = true, depth: number, depthPerPass: number, zSafe: number, tolerance = 0.1) {
    const toolRadius = toolDiameter / 2
    const points = mk.toKeyPoints(mk.clipperOffset(model, outside ? toolRadius : -toolRadius), tolerance)
    const offsetted = new maker.models.ConnectTheDots(true, points)
    openjscam.rapid({ z: zSafe })
    for (var pass = 1; pass <= Math.ceil(depth / depthPerPass); pass++) {
        let z = pass * depthPerPass
        if (z > depth) {
            z = depth
        }
        openjscam.rapid({ x: points[0][0], y: points[0][1] })
        openjscam.cut({ z: -z })
        points.map((point, i: number) => {
            openjscam.cut({ x: point[0], y: point[1] })
        })
        openjscam.rapid({ z: zSafe })
    }
    return {
        models: {
            contour: offsetted
        }
    }
}

export function cnc(drawing: maker.IModel, operations: IAnyOperation[], outModels: any = {}) {
    const chains: any = maker.model.findChains(drawing, {
        byLayers: true
    })
    operations.forEach((operation) => {
        operation.layers.forEach(layer => {
            if (chains[layer]) {
                const chainsForLayer = chains[layer]
                chainsForLayer.forEach((chain: any) => {
                    const model = maker.chain.toNewModel(chain)
                    if (operation.type === 'pocket') {
                        const id = `pocket_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = pocket(
                            maker.cloneObject(model),
                            operation.tool.diameter,
                            operation.depth,
                            operation.depthPerPass,
                            operation.zSafe,
                            operation.stockToLeave || 0,
                        )
                    } else if (operation.type === 'contour') {
                        const id = `contour_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = contour(
                            maker.cloneObject(model),
                            operation.tool.diameter,
                            operation.outside,
                            operation.depth,
                            operation.depthPerPass,
                            operation.zSafe,
                            operation.tolerance || 0.1,
                        )
                    } else if (operation.type === 'trace') {
                        const id = `trace_${Object.keys(outModels).length}_${operation.id}`
                        outModels[id] = trace(
                            maker.cloneObject(model),
                            operation.depth,
                            operation.depthPerPass,
                            operation.zSafe,
                            operation.tolerance || 0.1
                        )
                    }
                })
            }
        })
    })
    return {
        models: outModels
    } as maker.IModel
}