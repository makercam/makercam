import * as clipperLib from 'js-angusj-clipper'
import * as maker from 'makerjs'

let instance: any

function doOffset(modelToOutline: maker.IModel, offset: number, joints: number = 0) {
    instance.offsetToPaths({
        delta: offset,
        offsetInputs: {
            // data:,
            // joinType: 
        }
    })
}

function angusOffset(modelToOutline: maker.IModel, offset: number, joints: number = 0) {
    if (instance === undefined) {
        return clipperLib.loadNativeClipperLibInstanceAsync(
            clipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback
        ).then((lib) => {
            instance = lib
            return doOffset(modelToOutline, offset, joints)
        }) 
    }
    return doOffset(modelToOutline, offset, joints)
}

export default angusOffset