import Editor, { EditorProps } from "@monaco-editor/react";
import { useTheme } from "@/contexts/ThemeContext";

interface CodeEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    theme?: string;
    options?: EditorProps["options"];
    className?: string;
}

const CodeEditor = ({
    value,
    onChange,
    language = "java",
    theme: propTheme,
    options: propOptions,
    className,
}: CodeEditorProps) => {
    const { theme: contextTheme } = useTheme();

    // Use prop theme if provided, otherwise derive from context
    const editorTheme = propTheme || (contextTheme === "dark" ? "vs-dark" : "light");

    const defaultOptions: EditorProps["options"] = {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        renderLineHighlight: "line",
        selectOnLineNumbers: true,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: "on",
        padding: { top: 16 },
    };

    return (
        <Editor
            height="100%"
            language={language}
            value={value}
            onChange={onChange}
            theme={editorTheme}
            className={className}
            options={{
                ...defaultOptions,
                ...propOptions,
            }}
        />
    );
};

export default CodeEditor;
