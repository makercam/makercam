import makerjs from 'makerjs'

export default class Drawing {
    public coord: [number, number] = [0, 0]
    public model: makerjs.IModel = {
        models: {},
        paths: {}
    }
    public context: makerjs.IModel | makerjs.IPath | null = null
    public id = -1
    public stack: [number, number][] = [[0, 0]]

    getId(id: string | undefined) {
        if (typeof id === 'undefined') {
            this.id = this.id + 1
            return this.id
        }
        return id
    }

    move(offset: [number, number]) {
        const newCoord = [this.coord[0] + offset[0], this.coord[1] + offset[1]] as [number, number]
        this.coord = newCoord
        this.stack = [this.coord]
        return this
    }

    moveTo(coord: [number, number]) {
        this.coord = coord
        this.stack = [this.coord]
        return this
    }

    moveH(xLen: number) {
        this.coord = [xLen, this.coord[1]]
        this.stack = [this.coord]
        return this
    }

    moveV(yLen: number) {
        this.coord = [this.coord[0], yLen]
        this.stack = [this.coord]
        return this
    }

    lineTo(coord: [number, number], id?: string) {
        const line = new makerjs.paths.Line([this.coord, coord])
        this.model.paths![this.getId(id)] = line
        this.context = line
        this.coord = coord
        this.stack = [this.coord]
        return this
    }

    lineH(xLen: number, id?: string) {
        const newCoord = [this.coord[0] + xLen, this.coord[1]] as [number, number]
        const line = new makerjs.paths.Line([this.coord, newCoord])
        this.model.paths![this.getId(id)] = line
        this.context = line
        this.coord = newCoord
        this.stack = [this.coord]
        return this
    }

    lineV(yLen: number, id?: string) {
        const newCoord = [this.coord[0], this.coord[1] + yLen] as [number, number]
        const line = new makerjs.paths.Line([this.coord, newCoord])
        this.model.paths![this.getId(id)] = line
        this.context = line
        this.coord = newCoord
        this.stack = [this.coord]
        return this
    }

    arc(radius: number, startAngle: number, endAngle: number, id?: string) {
        const arcs: makerjs.IModel = { paths: {} }
        this.stack.forEach((coord, i) => {
            const arc = new makerjs.paths.Arc(coord, radius, startAngle, endAngle)
            const uniqueId = `${this.getId(id)}_${i}`
            arcs.paths![uniqueId] = arc
            this.model.paths![this.getId(uniqueId)] = arc
        })
        this.context = arcs
        return this
    }

    rect(xLen: number, yLen: number, centered: boolean = true, forConstruction = false, id?: string) {
        let newStack: [number, number][] = []
        const rects: makerjs.IModel = { models: {} }
        this.stack.forEach(coord => {
            const rect = makerjs.model.move(new makerjs.models.Rectangle(xLen, yLen), centered ? [(xLen / 2), -(yLen / 2)] : coord)
            if (!forConstruction) {
                const uniqueId = this.getId(id)
                rects.models![uniqueId] = rect
                this.model.models![uniqueId] = rect
            }
            const chain = makerjs.model.findSingleChain(rect)
            const keyPoints = makerjs.chain.toKeyPoints(chain)
            newStack = newStack.concat(keyPoints as [number, number][])
        })
        this.stack = newStack
        if (!forConstruction) {
            this.context = rects
        }
        return this
    }

    circle(radius: number, id?: string) {
        const circles: makerjs.IModel = { models: {} }
        this.stack.forEach(coord => {
            const uniqueId = this.getId(id)
            const circle = makerjs.path.move(new makerjs.paths.Circle(radius), coord)
            circles.models![uniqueId] = circle
            this.model.paths![uniqueId] = circle
        })
        this.context = circles
        return this
    }

    fillet(radius = 1) {
        if (this.context !== null) {
            const chains = makerjs.model.findChains(this.context) as makerjs.IChain[]
            chains.forEach(chain => {
                const filletsModel = makerjs.chain.fillet(chain, radius);
                this.model.models!.fillets = filletsModel
            })
        }
        return this
    }

    dogbone(dogboneOpts: any) {
        if (this.context !== null) {
            const chains = makerjs.model.findChains(this.context) as makerjs.IChain[]
            chains.forEach(chain => {
                const dogbonesModel = makerjs.chain.dogbone(chain, dogboneOpts);
                this.model.models!.dogbones = dogbonesModel
            })
        }
        return this
    }

    clone(id?: string) {
        const copy = makerjs.cloneObject(this.model)
        this.context = copy
        this.model.models![this.getId(id)] = copy
        return this
    }

    rotate(angle: number, rotationOrigin?: [number, number]) {
        if (this.context !== null) {
            if (makerjs.isPath(this.context)) {
                makerjs.path.rotate(this.context as makerjs.IPath, angle, rotationOrigin)
            } else {
                makerjs.model.rotate(this.context as makerjs.IModel, angle, rotationOrigin)
            }
        }
        return this
    }

    scale(scaleValue: number, scaleOrigin: boolean = false) {
        if (this.context !== null) {
            if (makerjs.isPath(this.context)) {
                makerjs.path.scale(this.context as makerjs.IPath, scaleValue)
            } else {
                makerjs.model.scale(this.context as makerjs.IModel, scaleValue, scaleOrigin)
            }
        }
        return this
    }

    union(otherModel: makerjs.IModel) {
        if (this.context !== null) {
            makerjs.model.combineUnion(this.context, otherModel)
        }
        return this
    }

    root() {
        this.context = this.model
        return this
    }

    result() {
        return this.model
    }

    svg() {
        const svg = makerjs.exporter.toSVG(this.result())
        if (typeof document !== 'undefined') {
            document.body.innerHTML = svg
        }
    }
}