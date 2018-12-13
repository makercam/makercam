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

function clipperOffset(modelToOutline: maker.IModel, offset: number, joints: number = 0) {
    const scale = 100
    const chains = maker.model.findChains(modelToOutline) as maker.IChain[]
    const models = chains.reduce((memo, chain, i) => {
        const minimumSpacing = 0.1;
        const divisions = Math.floor(chain.pathLength / minimumSpacing);
        const spacing = chain.pathLength / divisions;
        const keyPoints = maker.chain.toPoints(chain, spacing);
        keyPoints.push(keyPoints[0])
        let paths = [
            keyPoints.map((point: any) =>
                ({
                    X: Math.round(point[0] * scale),
                    Y: Math.round(point[1] * scale)
                })
            )
        ]
        paths = ClipperLib.Clipper.SimplifyPolygons(paths, ClipperLib.PolyFillType.pftNonZero);
        // const cleanDelta = 0.001
        // paths = ClipperLib.JS.Clean(paths, cleanDelta * scale);
        // const endType = EndTypes.etClosedPolygon
        const co = new ClipperLib.ClipperOffset()
        const offsetted = new ClipperLib.Paths()
        co.Clear()
        co.AddPaths(paths, JoinTypes[joints], EndTypes.etClosedLine)
        co.MiterLimit = 0
        co.ArcTolerance = 0.25;
        co.Execute(offsetted, offset * scale);
        let result: maker.IPoint[] = []
        offsetted.forEach((points: any) => {
            points.forEach((point: any) => {
                result.push([point.X / scale, point.Y / scale])
            })
        })
        // @ts-ignore
        memo[i] = new maker.models.ConnectTheDots(true, result)
        return memo
    }, {})
    return {
        models
    }
}

export default clipperOffset