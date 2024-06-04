// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import axios from "axios";
const fs = require('fs');

import { TextDecoder, TextEncoder } from 'util';

const base_url =
  "https://hub.ml.playment.io/user/naman.gupta@telusinternational.com/api/contents";
const token = "";
const base_dir = '/tmp/jupyter-explorer';

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "jupyter-explorer" is now active!'
  );

  let disposable = vscode.commands.registerCommand(
    "jupyter-explorer.helloWorld",
    () => {
      vscode.window.showInformationMessage("Hello World from hi");
    }
  );


  const rootPath = "/";
  vscode.window.registerTreeDataProvider(
    "jupyterTreeView",
    new JupyterTreeViewProvider(rootPath)
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(
    vscode.commands.registerCommand('jupyter.openJupyterFile', (label: string, filePath: string) => {
      openJupyterFile(label, filePath);
    })
  );

  vscode.workspace.onDidSaveTextDocument(async (document) => {
    const filePath = document.fileName.replace(base_dir, '');
    const content = document.getText();
    try {
      await saveJupyterFile(filePath, content);
      vscode.window.showInformationMessage(`File saved: ${filePath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save file: ${error}`);
    }
  });


  vscode.workspace.onDidSaveNotebookDocument(async (document) => {
    console.log(document);
    // const filePath = document.fileName.replace(base_dir, '');
    // const content = document.getText();
    // try {
    //   await saveJupyterFile(filePath, content);
    //   vscode.window.showInformationMessage(`File saved: ${filePath}`);
    // } catch (error) {
    //   vscode.window.showErrorMessage(`Failed to save file: ${error}`);
    // }
  });
}

export class JupyterTreeViewProvider
  implements vscode.TreeDataProvider<JupyterItem> {
  constructor(private workspaceRoot: string) {
    // console.log("Constructor");
  }

  getTreeItem(element: JupyterItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: JupyterItem | undefined
  ): vscode.ProviderResult<JupyterItem[]> {
    var path = "/";
    if (element === undefined) {
      path = "";
    } else {
      path = element.path;
    }


    return Promise.resolve(
      axios
        .get(base_url + path, {
          headers: {
            Authorization: `token ${token}`,
          },
        })
        .then((response) => {
          const items: JupyterItem[] = [];
          response.data.content.forEach((element: any) => {
            var item = new JupyterItem(
              element.name,
              vscode.TreeItemCollapsibleState.Collapsed,
              path + "/" + element.name,
              element.type
            );
            items.push(
              item
            );

          });

          return items;
        })
        .catch((err) => console.log("Error", err))
        .finally(() => {
        })
    );
  }
}

class JupyterItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly path: string,
    public readonly type: string
  ) {
    super(label, collapsibleState);
    if (this.type === "directory") {
      this.iconPath = vscode.ThemeIcon.Folder;
    } else {
      this.iconPath = vscode.ThemeIcon.File;
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
      this.command = {
        command: "jupyter.openJupyterFile",
        title: "Open call",
        arguments: [this.label, this.path],
      };
    }
  }
}


function getContents(filePath: string): Promise<any> {
  return axios.get(base_url + filePath, {
    headers: {
      Authorization: `token ${token}`
    }
  })
    .then(response => response.data)
    .catch(err =>
      console.log(`Error fetching contents of file ${filePath}: ${err}`)
    );
}


async function openJupyterFile(label: string, filePath: string): Promise<void> {
  try {
    const ext = label.split('.').pop();
    const localFilePath = `${base_dir}${filePath}`;
    const exists = await fs.existsSync(localFilePath);
    let uri = vscode.Uri.parse(`untitled:${localFilePath}`);

    if (exists) {
      uri = vscode.Uri.parse(`file://${localFilePath}`);
    }
    let contents = await getContents(filePath);
    let { content, type, mimetype, last_modified }: any = contents;

    if (type === 'notebook') {
      let cells = generateNotebookData(content);
      const document = await vscode.workspace.openNotebookDocument(uri);
      const editor = await vscode.window.showNotebookDocument(document, {
        preview: false,
        preserveFocus: false
      });

      const edit = new vscode.WorkspaceEdit();
      const replaceCells = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(0, document.cellCount), cells.cells);
      edit.set(document.uri, [replaceCells]);
      console.log('URI:', document.uri);
      await vscode.workspace.applyEdit(edit);

      // await document.save();
    } else {
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false
      });

      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), content);
      console.log('URI:', document.uri);
      await vscode.workspace.applyEdit(edit);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open file: ${error}`);
  }
}

function generateNotebookData(content: NotebookContent) {
  let cellContent = content.cells;
  const cells = cellContent.map(
    item =>
      new vscode.NotebookCellData(
        item.cell_type === 'code'
          ? vscode.NotebookCellKind.Code
          : vscode.NotebookCellKind.Markup,
        item.source,
        item.cell_type === 'code' ? 'python' : 'markdown'
      )
  );

  return new vscode.NotebookData(cells);
}

async function saveJupyterFile(filePath: string, content: string): Promise<void> {
  console.log(`Saving at ${base_url}${filePath}`);
  const response = await axios.put(`${base_url}${filePath}`,
    JSON.stringify({ 'content': content, 'format': 'text', 'type': 'file' }), {
    headers: {
      Authorization: `token ${token}`
    }
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error(`HTTP error! status: ${response.status}`);
  } else {
    console.log('File saved!', response.data);
  }
}


export async function deactivate() {
  console.log('Deactivating...');
  console.log(await fs.rm(base_dir, { recursive: true, force: true }));
}


interface NotebookContent {
  cells: NotebookCell[]
}

interface NotebookCell {
  cell_type: string,
  source: string,
}