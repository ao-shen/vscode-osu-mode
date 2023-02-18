import * as vscode from 'vscode';
import { Plugin } from './plugin';

export interface ComboMeterConfig {
    enableComboCounter?: boolean;
    enableComboImage?: boolean;
    comboImageInterval?: number;
    customComboImages?: string[];
}

export class ComboMeter implements Plugin {

    private config: ComboMeterConfig = {};
    private comboTitleDecoration: vscode.TextEditorDecorationType;
    private comboCountDecoration: vscode.TextEditorDecorationType;
    
    private renderedComboCount: number = undefined;
    private combo: number = 0;
    private renderedImageCount: number = -1;
    // TODO: Currently unused. Use this to style the combo
    private osumode: boolean = false;
    private enabled: boolean = false;

    private disposeTimer = undefined;

    private comboCountAnimationTimer = undefined;
    private comboImageAnimationTimer = undefined;

    private orange: vscode.OutputChannel = undefined;

    private static readonly DEFAULT_CSS = ComboMeter.objectToCssString({
        position: 'absolute',
        right: "5%",
        top: "20px",

        ['font-family']: "monospace",
        ['font-weight']: "900",

        // width: "50px",
        ['z-index']: 1,
        ['pointer-events']: 'none',
        ["text-align"]: "right",
    });

    constructor() {
        this.activate();
    }

    public activate = () => {
        vscode.window.onDidChangeTextEditorVisibleRanges((e: vscode.TextEditorVisibleRangesChangeEvent) => {
            this.updateDecorations(e.textEditor);
        });

        /*if(this.orange) {
        } else {
            this.orange = vscode.window.createOutputChannel("Orange");
        }*/
    }

    dispose = () => {
        if (this.comboCountDecoration) {
            clearTimeout(this.comboCountAnimationTimer);
            this.comboCountDecoration.dispose();
            this.comboCountDecoration = null;
        }

        if (this.comboTitleDecoration) {
            clearTimeout(this.comboImageAnimationTimer);
            this.comboTitleDecoration.dispose();
            this.comboTitleDecoration = null;
        }
    }

    public onOsumodeStart = (combo: number) => {
        this.osumode = true;
    }

    public onOsumodeStop = (combo: number) => {
        this.osumode = false;
    }

    public onComboStart = (combo: number) => {
        this.combo = combo;
        this.updateDecorations();
    }

    public onComboStop = (combo: number) => {
        this.combo = combo;
        this.updateDecorations();
    }

    public onDidChangeTextDocument = (combo: number, osumode: boolean, event: vscode.TextDocumentChangeEvent) => {
        this.combo = combo;
        this.osumode = osumode;
        this.updateDecorations();
    }

    public onDidChangeConfiguration = (config: vscode.WorkspaceConfiguration) => {
        this.config.enableComboCounter = config.get<boolean>('enableComboCounter', true);
        this.config.enableComboImage = config.get<boolean>('enableComboImage', true);
        this.config.comboImageInterval = config.get<number>('comboImageInterval', 50);
        this.config.customComboImages = config.get<string[]>('customComboImages', []);
        if (this.config.enableComboCounter) {
            this.enabled = true;
            this.activate();
        } else {
            this.enabled = false;
            this.dispose();
        }
    }

    private updateDecorations = (editor: vscode.TextEditor = vscode.window.activeTextEditor) => {
        if (!this.enabled) {
            return;
        }

        const firstVisibleRange = editor.visibleRanges.sort()[0];
        
        if (!firstVisibleRange || this.combo < 2) { //^^^ hide title if combo less than..
            this.dispose();
            return;
        }

        clearTimeout(this.disposeTimer);
        this.disposeTimer = setTimeout(()=>{
            this.dispose();
        },10000);

        const position = firstVisibleRange.start;
        const ranges = [new vscode.Range(position, position)];

        // The combo title doesn't ever change, so only create it once
        // !!this.comboTitleDecoration || this.createComboTitleDecoration();
        // If the combo count changes, however, create a new decoration
        if (this.combo !== this.renderedComboCount) {
            this.renderedComboCount = this.combo;
            this.createComboCountDecoration(this.combo, ranges, editor);
            this.createComboTitleDecoration(this.combo, ranges, editor); //^^^ add counter value for change title
        }

    }

    private createComboTitleDecoration(count: number, ranges: vscode.Range[], editor: vscode.TextEditor = vscode.window.activeTextEditor) {

        const comboImageInterval = this.config.comboImageInterval;

        let comboImages = [
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Diona_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Qiqi_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Klee_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Fischl_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Hu_Tao_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Ganyu_Portrait.png",
            "https://raw.githubusercontent.com/ao-shen/vscode-power-mode/master/images/Character_Keqing_Portrait.png",
        ];

        if(this.config.customComboImages.length !== 0) {
            comboImages = this.config.customComboImages;
        }

        const imageCount = (Math.floor( count / comboImageInterval ) - 1);
        
        const imgIdx = imageCount % comboImages.length;

        const imgUrl = imgIdx === -1 ? "" : comboImages[imgIdx];

        if(this.renderedImageCount != imageCount) {
            this.renderedImageCount = imageCount;

            const thisObj = this;

            let animateComboImageDecoration = function(frameCount: number) {

                let posX = 0;
                let delay = 10;

                if(frameCount < 15) {
                    posX = 15 - frameCount;
                    delay = 10;
                } else if(frameCount < 16) {
                    posX = 0;
                    delay = 1000;
                } else {
                    posX = 0.005*Math.pow(frameCount-16,2);
                    delay = 20;
                }

                let backgroundImageCss = {
                    ["width"]: `60vh`,
                    ["height"]: `80vh`,
                    ["background-repeat"]: 'no-repeat',
                    ["background-size"]: 'contain',
                    ["background-position"]: 'right',
                    ['z-index']: -1,
                    //["background-color"]: `#ff000010`,
                    ["right"]: `${-posX}vh`,
                };
        
                if(imgUrl.length !== 0) {
                    backgroundImageCss["background-image"] = `url("${imgUrl}")`;
                }
        
                const titleCss = ComboMeter.objectToCssString(backgroundImageCss);
        
                let newComboTitleDecoration = vscode.window.createTextEditorDecorationType({
                    // Title and Count cannot use the same pseudoelement
                    before: {
                        contentText: "",
                        color: "#fff",
                        textDecoration: `none; ${ComboMeter.DEFAULT_CSS} ${titleCss}`,
                    },
                    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
                });
                
                editor.setDecorations(newComboTitleDecoration, ranges);
                
                thisObj.comboTitleDecoration && thisObj.comboTitleDecoration.dispose();
                thisObj.comboTitleDecoration = newComboTitleDecoration;

                if(frameCount < 150) {
                    thisObj.comboImageAnimationTimer = setTimeout(()=>{
                        animateComboImageDecoration(frameCount+1);
                    }, delay);
                }
            }

            clearTimeout(this.comboImageAnimationTimer);
            animateComboImageDecoration(0);
        }
    }

    private createComboCountDecoration(count: number, ranges: vscode.Range[], editor: vscode.TextEditor = vscode.window.activeTextEditor) {

        const thisObj = this;

        let animateComboCountDecoration = function(frameCount: number) {

            const styleCount = count > 100 ? 100 : count;
            const styleColor = 'hsl(' + (100 - count * 1.2) + ', 100%, 45%)';

            let textSize = ((styleCount*6)/100*Math.pow(0.5,frameCount*0.2)+6);

            const countCss = ComboMeter.objectToCssString({
                ["font-size"]: `${textSize}em`,
                ["text-align"]: "center",
                ["text-shadow"]: `0px 0px 15px ${styleColor}`,
            });
    
            let newComboCountDecoration = vscode.window.createTextEditorDecorationType({
                // Title and Count cannot use the same pseudoelement
                after: {
                    margin: ".8em 0 0 0",
                    contentText: `${count}×`,
                    color: "#ffffff",
                    textDecoration: `none; ${ComboMeter.DEFAULT_CSS} ${countCss}`,
                },
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            });

            editor.setDecorations(newComboCountDecoration, ranges);

            thisObj.comboCountDecoration && thisObj.comboCountDecoration.dispose();
            thisObj.comboCountDecoration = newComboCountDecoration

            if(frameCount < 100) {
                thisObj.comboCountAnimationTimer = setTimeout(()=>{
                    animateComboCountDecoration(frameCount+1);
                }, 20 + 0.5 * frameCount);
            }
        }

        clearTimeout(this.comboCountAnimationTimer);
        animateComboCountDecoration(0);
    }

    private static objectToCssString(settings: any): string {
        let value = '';
        const cssString = Object.keys(settings).map(setting => {
            value = settings[setting];
            if (typeof value === 'string' || typeof value === 'number') {
                return `${setting}: ${value};`
            }
        }).join(' ');

        return cssString;
    }
}