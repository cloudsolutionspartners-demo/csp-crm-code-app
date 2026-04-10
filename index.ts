import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import App from "./App";

export class CSPCRMApp implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private context: ComponentFramework.Context<IInputs>;

  constructor() {}

  public init(context: ComponentFramework.Context<IInputs>): void {
    this.context = context;
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    return React.createElement(App, { context });
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {}
}
