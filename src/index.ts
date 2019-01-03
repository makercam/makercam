/// <reference path="./index.d.ts" />
import * as maker from 'makerjs'
import * as openjscam from '@makercam/openjscam'
import mk from './make'
export * from './operations'

export const makerjs = maker
export const make = mk
export const cam = openjscam