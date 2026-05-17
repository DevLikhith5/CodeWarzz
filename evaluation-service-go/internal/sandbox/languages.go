package sandbox

type Language string

const (
	CPP        Language = "cpp"
	Python     Language = "python"
	JavaScript Language = "javascript"
	Java       Language = "java"
	Go         Language = "go"
	Rust       Language = "rust"
)

type LanguageConfig struct {
	Image          string
	SourceFile     string
	CompileCommand string
	RunCommand     string
}

var Languages = map[Language]LanguageConfig{
	CPP: {
		Image:          "cpp-runner",
		SourceFile:     "solution.cpp",
		CompileCommand: "g++ solution.cpp -O2 -std=gnu++17 -o solution",
		RunCommand:     "./solution",
	},
	Python: {
		Image:      "python-runner",
		SourceFile: "solution.py",
		RunCommand: "python solution.py",
	},
	JavaScript: {
		Image:      "node-runner",
		SourceFile: "solution.js",
		RunCommand: "node solution.js",
	},
	Java: {
		Image:          "java-runner",
		SourceFile:     "Main.java",
		CompileCommand: "javac Main.java",
		RunCommand:     "java Main",
	},
	Go: {
		Image:          "go-runner",
		SourceFile:     "solution.go",
		CompileCommand: "go build -o solution solution.go",
		RunCommand:     "./solution",
	},
	Rust: {
		Image:          "rust-runner",
		SourceFile:     "solution.rs",
		CompileCommand: "rustc -O -o solution solution.rs",
		RunCommand:     "./solution",
	},
}
