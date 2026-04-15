import type { Editor } from "@tiptap/core";

function insertImageFile(editor: Editor, file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      editor.chain().focus().setImage({ src: reader.result }).run();
    }
  };
  reader.readAsDataURL(file);
}

export function setupImageHandlers(editorEl: HTMLElement, getEditor: () => Editor | undefined) {
  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        const ed = getEditor();
        if (file && ed) insertImageFile(ed, file);
        return;
      }
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    const ed = getEditor();
    if (!ed) return;
    for (const file of files) {
      if (file.type.startsWith("image/")) insertImageFile(ed, file);
    }
  }

  function handleFileInput(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    const ed = getEditor();
    if (file && ed) insertImageFile(ed, file);
    e.currentTarget.value = "";
  }

  editorEl.addEventListener("paste", handlePaste);
  editorEl.addEventListener("dragover", (e) => e.preventDefault());
  editorEl.addEventListener("drop", handleDrop);

  function cleanup() {
    editorEl.removeEventListener("paste", handlePaste);
    editorEl.removeEventListener("drop", handleDrop);
  }

  return { cleanup, handleFileInput };
}
