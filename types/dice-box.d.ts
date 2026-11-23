// Minimal types for @3d-dice/dice-box 1.1.x (the package ships none).
// https://fantasticdice.games/docs/usage/config
declare module "@3d-dice/dice-box" {
  export type DieResult = {
    groupId: number;
    rollId: number;
    sides: number;
    theme: string;
    value: number;
  };
  export type RollGroup = {
    id: number;
    qty: number;
    sides: number;
    modifier: number;
    value: number;
    rolls: DieResult[];
  };
  export type DiceBoxConfig = {
    container?: string;
    id?: string;
    assetPath: string;
    origin?: string;
    offscreen?: boolean;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
    settleTimeout?: number;
    delay?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    theme?: string;
    themeColor?: string;
    preloadThemes?: string[];
    suspendSimulation?: boolean;
    onRollComplete?: (results: RollGroup[]) => void;
  };
  export default class DiceBox {
    constructor(config: DiceBoxConfig);
    init(): Promise<void>;
    // Resolves with one entry per die once every die has settled.
    roll(notation: string | string[], opts?: { theme?: string; themeColor?: string }): Promise<DieResult[]>;
    add(notation: string | string[], opts?: { theme?: string; themeColor?: string }): Promise<DieResult[]>;
    clear(): this;
    hide(className?: string): this;
    show(): this;
    updateConfig(config: Partial<DiceBoxConfig>): Promise<void>;
  }
}
