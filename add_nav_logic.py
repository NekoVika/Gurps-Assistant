with open('web/src/components/MainWorkspace.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_logic = '''
  const handleNavigateTo = async (targetName: string) => {
    if (!targetName || !fileTree) return;
    const lowerName = targetName.toLowerCase();
    
    const findNode = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.node_type === "file") {
          const nameWithoutExt = node.name.replace(/\.[^/.]+$/, "").toLowerCase();
          if (nameWithoutExt === lowerName || node.name.toLowerCase() === lowerName) {
            return node;
          }
        }
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const targetNode = findNode(fileTree);
    if (targetNode) {
      try {
        const content = await getFileContent(targetNode.path);
        setSelectedFile(content);
        setEditedContent(content.content);
        setFileContentError(null);
        setActiveTab("main");
      } catch (err: any) {
        alert("Failed to open linked file: " + err.message);
      }
    } else {
      // alert(\File for "\" not found in workspace.\);
    }
  };
'''

# insert it after const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
content = content.replace('const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);', 'const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);\n' + new_logic)

with open('web/src/components/MainWorkspace.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
