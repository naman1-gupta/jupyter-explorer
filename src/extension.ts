// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import axios from "axios";

import { TextDecoder, TextEncoder } from 'util';

const base_url =
  "https://hub.ml.playment.io/user/naman.gupta@telusinternational.com/api/contents";
const token = "";
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
    }));
  context.subscriptions.push(vscode.workspace.registerNotebookSerializer('notebook', new JupyterNotebookProvider()));
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
          console.log("Contents: ", response.data)
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

            // console.log('Item', item)
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
  }).then(response => response.data).catch(err => console.log(`Error fetching contents of file ${filePath}: ${err}`));
}


async function openJupyterFile(label: string, filePath: string): Promise<void> {
  try {
    const ext = label.split('.').pop();


    const uri = vscode.Uri.parse(`untitled:${label}`);


    if (ext === 'ipynb') {
      let contents = await getContents(filePath);
      let { content }: any = contents;
      let cells = generateNotebookData(content);
      const document = await vscode.workspace.openNotebookDocument('jupyter-notebook', cells);
      const editor = await vscode.window.showNotebookDocument(document, {
        preview: false,
        preserveFocus: false
      });


    } else {
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false
      });

      let contents = await getContents(filePath);
      let { content }: any = contents;


      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), content);
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


export function deactivate() { }


interface NotebookContent {
  cells: NotebookCell[]
}

interface NotebookCell {
  cell_type: string,
  source: string,
}


// interface RawNotebook {
//   cells: RawNotebookCell[];
// }

// interface RawNotebookCell {
//   source: string[];
//   cell_type: 'code' | 'markdown';
// }


// export class JupyterNotebookProvider implements vscode.NotebookSerializer {
//   async deserializeNotebook(
//     content: Uint8Array,
//     _token: vscode.CancellationToken
//   ): Promise<vscode.NotebookData> {
//     var contents = new TextDecoder().decode(content);

//     let raw: RawNotebookCell[];
//     try {
//       raw = (<RawNotebook>JSON.parse(contents)).cells;
//     } catch {
//       raw = [];
//     }

//     const cells = raw.map(
//       item =>
//         new vscode.NotebookCellData(
//           item.cell_type === 'code'
//             ? vscode.NotebookCellKind.Code
//             : vscode.NotebookCellKind.Markup,
//           item.source.join('\n'),
//           item.cell_type === 'code' ? 'python' : 'markdown'
//         )
//     );

//     return new vscode.NotebookData(cells);
//   }

//   async serializeNotebook(
//     data: vscode.NotebookData,
//     _token: vscode.CancellationToken
//   ): Promise<Uint8Array> {
//     let contents: RawNotebookCell[] = [];

//     for (const cell of data.cells) {
//       contents.push({
//         cell_type: cell.kind === vscode.NotebookCellKind.Code ? 'code' : 'markdown',
//         source: cell.value.split(/\r?\n/g)
//       });
//     }

//     return new TextEncoder().encode(JSON.stringify(contents));
//   }
// }
