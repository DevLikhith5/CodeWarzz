export type Language = "cpp" | "python" | "javascript" | "java";

export interface LanguageConfig {
    image:string;
    sourceFile:string;
    compileCommand?:string;
    runCommand:string;
}

export const languageConfig: Record<Language, LanguageConfig> = {
  cpp: {
    image: "cpp-runner",
    sourceFile: "solution.cpp",
    compileCommand: "g++ solution.cpp -O2 -std=gnu++17 -o solution",
    runCommand: "./solution",
  },
  python: {
    image: "python-runner",
    sourceFile: "solution.py",
    runCommand: "python solution.py",
  },
  javascript: {
    image: "node-runner",
    sourceFile: "solution.js",
    runCommand: "node solution.js",
  },
  java: {
    image: "java-runner",
    sourceFile: "Main.java",
    compileCommand: "javac Main.java",
    runCommand: "java Main",
  },
};
