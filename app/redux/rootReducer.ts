import * as uuid from "uuid";
import { Action, handleActions } from "redux-actions";
import { Drawing, DrawingType, createStaticPoint, createDynamicPoint, createLine, createPath, Doc } from "../models";
import { UIMode, RootState, initialRootState } from "./RootState";
import * as ActionType from "./ActionTypes";
import { combineReducers } from "./combineReducers";

type DrawingCreateMap = Partial<{ 
    [mode in UIMode]: Function
}>;
function tryCreateDrawing(mode: UIMode, params: any[]): Drawing {
    const creationMap: DrawingCreateMap = {
        'p': createStaticPoint,
        'd': createDynamicPoint,
        'l': createLine,
        'v': createPath
    };

    if (creationMap[mode] && params.length >= creationMap[mode].length) {
        return creationMap[mode](...params);
    }
    return null;
}

const STORAGE_KEY = 'lastSvgBoardState';

export function rootReducer(rootState: RootState, { type, payload }: Action<any>) {
    if (!rootState) {
        try {
            rootState = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) {
            rootState = null;
        }
    }
    rootState = rootState || initialRootState;

    let { activeDocId, docIds, docs, ui } = rootState;
    let { drawingList, idMap, name } = docs[activeDocId];
    let { mode, params, tween, selectedDrawingId, showAllTrack } = ui;

    const resetUI = () => {
        mode = 'idle';
        params = [];
        selectedDrawingId = null;
    }

    const resetActiveDoc = () => {
        const doc = docs[activeDocId];
        drawingList = doc.drawingList;
        idMap = doc.idMap;
        name = doc.name;
        resetUI();
    }

    switch (type) {
    // 创建文档
    case ActionType.NEW_DOC:
        activeDocId = uuid();
        name = payload.name;
        drawingList = [];
        idMap = {};
        docIds.push(activeDocId);
        resetUI();
        break;

    // 切换文档
    case ActionType.SWITCH_DOC:
        activeDocId = payload;
        resetActiveDoc();
        break;
    
    // 导入文档
    case ActionType.IMPORT_DOC:
        const doc = payload as Doc;
        activeDocId = uuid();
        name = doc.name;
        drawingList = doc.drawingList;
        idMap = doc.idMap;
        docIds.push(activeDocId);
        resetUI();
        break;

    // 删除文档
    case ActionType.DELETE_DOC:
        const deleteDocId: string = payload;
        const deleteIndex = docIds.indexOf(deleteDocId);
        if (deleteIndex !== -1) {
            docIds.splice(deleteIndex, 1);
            delete docs[deleteDocId];
        }
        if (deleteDocId == activeDocId) {
            let nextActiveDocId = docIds[deleteIndex] || docIds[deleteIndex - 1];
            if (!nextActiveDocId) {
                nextActiveDocId = 'default';
                name = '默认';
                drawingList = [];
                idMap = {};
                docIds.push('default');
            }
            activeDocId = nextActiveDocId;
        }
        break;
    
    // 重命名文档
    case ActionType.RENAME_DOC:
        const { docId, newName } = payload;
        if (docId == activeDocId) {
            name = newName;
        } else {
            docs[docId].name = newName;
        }
        break;

    // 清除画布
    case ActionType.CLEAR_CANVAS:
        drawingList = [];
        idMap = {};
        resetUI();
        break;
    
    // 开始绘制
    case ActionType.INTERACT_START:
        mode = payload;
        params = [];
        break;

    // 绘制交互继续
    case ActionType.INTERACT_NEXT:
        params = [...params, ...payload];
        const drawing = tryCreateDrawing(mode, params);
        if (drawing) {
            drawing.id += idMap[drawing.id] ? ++idMap[drawing.id] : (idMap[drawing.id] = 1);
            drawingList = [...drawingList, drawing];
            params = [];
            mode = "idle";
            selectedDrawingId = drawing.id;
        }
        break;

    // 选中指定的图形
    case ActionType.SELECT_DRAWING:
        selectedDrawingId = payload;
        break;

    // 更新指定的图形
    case ActionType.UPDATE_DRAWING:
        const updateDrawing = payload as Drawing;
        const updateDrawingIndex = drawingList.findIndex(x => x.id == updateDrawing.id);
        if (updateDrawingIndex > -1) {
            let targetDrawing = drawingList[updateDrawingIndex];
            targetDrawing = Object.assign({}, targetDrawing, updateDrawing);
            drawingList.splice(updateDrawingIndex, 1, targetDrawing);
            drawingList = drawingList.slice();
        }
        break;

    // 更新补间位置
    case ActionType.UPDATE_TWEEN:
        tween = payload;
        break;

    // 是否显示所有轨道
    case ActionType.SHOW_ALL_TRACK:
        showAllTrack = payload;
        break;
    }

    // 组装 RootState
    const nextState: RootState = {
        activeDocId,
        docIds,
        docs: { ...docs, [activeDocId]: {
            name,
            drawingList,
            idMap,
        }},
        ui: {
            mode,
            params,
            tween,
            selectedDrawingId,
            showAllTrack
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
};