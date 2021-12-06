/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 * 
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */
import { Data } from './Data';

export class Editor { 
    constructor(json: JSON | any) {
        Object.assign(this as Editor, json)
    }

    left?: number;
    top?: number;
    width?: number;
    height?: number;
    multiline?: boolean;
    labelPosition?: Editor.LabelPositionEnum;
    readOnly?: boolean;
    defaultValue?: Data;
    key?: string;
}
export namespace Editor {
    export type LabelPositionEnum = 'Up' | 'Down' | 'Left' | 'Right';
    export const LabelPositionEnum = {
        Up: 'Up' as LabelPositionEnum,
        Down: 'Down' as LabelPositionEnum,
        Left: 'Left' as LabelPositionEnum,
        Right: 'Right' as LabelPositionEnum
    };
}

