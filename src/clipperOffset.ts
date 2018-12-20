import ClipperLib from 'clipper-lib'
import * as maker from 'makerjs'

const EndTypes = {
    etOpenSquare: 0,
    etOpenRound: 1,
    etOpenButt: 2,
    etClosedPolygon: 3,
    etClosedLine: 4
};

const JoinTypes = [
    ClipperLib.JoinType.jtSquare,
    ClipperLib.JoinType.jtRound,
    ClipperLib.JoinType.jtMiter
]


function clipperOffset(modelToOutline: maker.IModel, offset: number, joints: number = 0, tolerance: number = 0.1): maker.IModel {
    const scale = 1000
    const chains = maker.model.findChains(modelToOutline) as maker.IChain[]
    const models = chains.reduce((memo, chain, i) => {
        const divisions = Math.floor(chain.pathLength / tolerance);
        const spacing = chain.pathLength / divisions;
        const keyPoints = maker.chain.toKeyPoints(chain, spacing);
        if (chain.endless) {
            keyPoints.push(keyPoints[0])
        }
        let paths = [
            keyPoints.map((point: any) =>
                ({
                    X: Math.round(point[0] * scale),
                    Y: Math.round(point[1] * scale)
                })
            )
        ]
        const co = new ClipperLib.ClipperOffset()
        const offsetted = new ClipperLib.Paths()
        co.Clear()
        co.AddPaths(paths, JoinTypes[joints], chain.endless ? EndTypes.etClosedLine : EndTypes.etOpenButt)
        co.MiterLimit = 2
        co.ArcTolerance = 0.25
        co.Execute(offsetted, offset * scale);
        offsetted.forEach((points: any, j: number) => {
            if (points.length === 0) return
            let result: maker.IPoint[] = []
            points.forEach((point: any) => {
                result.push([point.X / scale, point.Y / scale])
            })
            const newModel = new maker.models.ConnectTheDots(chain.endless, result)
            // @ts-ignore
            memo[i+'_'+j] = newModel
        })
        return memo
    }, {})
    return {
        models
    }
}

export default clipperOffset