import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Save, FileText, Code2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";

interface TestCase {
    input: string;
    output: string;
    isSample: boolean;
}

const CreateProblem = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("details");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        difficulty: "EASY",
        slug: "",
        tags: "",
        hints: "",
    });

    const [testCases, setTestCases] = useState<TestCase[]>([
        { input: "", output: "", isSample: true }
    ]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleValueChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addTestCase = () => {
        setTestCases([...testCases, { input: "", output: "", isSample: false }]);
    };

    const removeTestCase = (index: number) => {
        setTestCases(testCases.filter((_, i) => i !== index));
    };

    const handleTestCaseChange = (index: number, field: keyof TestCase, value: string | boolean) => {
        const newTestCases = [...testCases];
        newTestCases[index] = { ...newTestCases[index], [field]: value };
        setTestCases(newTestCases);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                difficulty: formData.difficulty,
                slug: formData.title.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, ""), // Simple slug gen
                testcases: testCases.filter(tc => tc.input && tc.output), // Filter empty ones
                tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
                hints: formData.hints.split("\n").map(h => h.trim()).filter(Boolean),
            };

            await api.post("/problems", payload);
            toast.success("Problem created successfully!");
            navigate("/problems");
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to create problem");
        } finally {
            setLoading(false);
        }
    };

    const nextTab = () => {
        if (activeTab === "details") setActiveTab("content");
        else if (activeTab === "content") setActiveTab("testcases");
    };

    const prevTab = () => {
        if (activeTab === "testcases") setActiveTab("content");
        else if (activeTab === "content") setActiveTab("details");
    };

    return (
        <div className="min-h-screen bg-background">
            <AppNavbar />
            <main className="container mx-auto px-4 py-24 max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create Problem</h1>
                        <p className="text-muted-foreground mt-1">Design a new coding challenge for the community.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Sidebar Steps */}
                        <div className="lg:col-span-1 space-y-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("details")}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === "details" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                <FileText className="w-4 h-4" /> Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("content")}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === "content" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                <Code2 className="w-4 h-4" /> Content
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("testcases")}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === "testcases" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                            >
                                <CheckCircle className="w-4 h-4" /> Test Cases
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="lg:col-span-3">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                                <TabsContent value="details" className="mt-0 space-y-6">
                                    <Card className="border-none shadow-none bg-transparent">
                                        <CardHeader className="px-0 pt-0">
                                            <CardTitle>Basic Information</CardTitle>
                                            <CardDescription>
                                                Define the core attributes of your problem.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 px-0">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Title</label>
                                                <Input
                                                    name="title"
                                                    value={formData.title}
                                                    onChange={handleInputChange}
                                                    placeholder="e.g. Two Sum"
                                                    required
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Difficulty</label>
                                                    <Select value={formData.difficulty} onValueChange={(val) => handleValueChange("difficulty", val)}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="EASY">Easy</SelectItem>
                                                            <SelectItem value="MEDIUM">Medium</SelectItem>
                                                            <SelectItem value="HARD">Hard</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Topic Tags</label>
                                                    <Input
                                                        name="tags"
                                                        value={formData.tags}
                                                        onChange={handleInputChange}
                                                        placeholder="Array, Hash Table"
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="flex justify-end">
                                        <Button type="button" onClick={nextTab}>
                                            Next: Content <ArrowRight className="ml-2 w-4 h-4" />
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="content" className="mt-0 space-y-6">
                                    <Card className="border-none shadow-none bg-transparent">
                                        <CardHeader className="px-0 pt-0">
                                            <CardTitle>Problem Description</CardTitle>
                                            <CardDescription>
                                                Write a clear and concise problem statement using Markdown.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4 px-0">
                                            <Textarea
                                                name="description"
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                placeholder="Describe the problem..."
                                                className="min-h-[300px] font-mono text-sm leading-relaxed"
                                                required
                                            />
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Hints (Optional)</label>
                                                <Textarea
                                                    name="hints"
                                                    value={formData.hints}
                                                    onChange={handleInputChange}
                                                    placeholder="Enter limits or tips, one per line..."
                                                    className="min-h-[100px]"
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="flex justify-between">
                                        <Button type="button" variant="outline" onClick={prevTab}>
                                            <ArrowLeft className="mr-2 w-4 h-4" /> Back
                                        </Button>
                                        <Button type="button" onClick={nextTab}>
                                            Next: Test Cases <ArrowRight className="ml-2 w-4 h-4" />
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="testcases" className="mt-0 space-y-6">
                                    <Card className="border-none shadow-none bg-transparent">
                                        <CardHeader className="flex flex-row items-center justify-between px-0 pt-0">
                                            <div>
                                                <CardTitle>Test Cases</CardTitle>
                                                <CardDescription>Define input/output pairs for validation.</CardDescription>
                                            </div>
                                            <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
                                                <Plus className="w-4 h-4 mr-2" /> Add Case
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="space-y-6 px-0">
                                            {testCases.map((tc, index) => (
                                                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start py-6 border-b border-border/10 last:border-0">
                                                    <div className="md:col-span-1 flex justify-center py-2">
                                                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                            {index + 1}
                                                        </span>
                                                    </div>
                                                    <div className="md:col-span-10 grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-muted-foreground">Input</label>
                                                            <Textarea
                                                                value={tc.input}
                                                                onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                                                                placeholder="Input data"
                                                                className="font-mono text-sm h-20 min-h-[100px] bg-muted/5 border-border/20 resize-none focus-visible:ring-1"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-muted-foreground">Output</label>
                                                            <Textarea
                                                                value={tc.output}
                                                                onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                                                                placeholder="Expected output"
                                                                className="font-mono text-sm h-20 min-h-[100px] bg-muted/5 border-border/20 resize-none focus-visible:ring-1"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="md:col-span-1 flex flex-col gap-2 items-center justify-start pt-8">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                            onClick={() => removeTestCase(index)}
                                                            disabled={testCases.length === 1}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                        <div className="flex flex-col items-center gap-1" title="Visible as sample case">
                                                            <input
                                                                type="checkbox"
                                                                checked={tc.isSample}
                                                                onChange={(e) => handleTestCaseChange(index, "isSample", e.target.checked)}
                                                                className="rounded border-border/40 bg-muted/5 w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                                                                id={`is-sample-${index}`}
                                                            />
                                                            <label htmlFor={`is-sample-${index}`} className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground cursor-pointer">
                                                                Sample
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    <div className="flex justify-between items-center pt-4 border-t">
                                        <Button type="button" variant="outline" onClick={prevTab}>
                                            <ArrowLeft className="mr-2 w-4 h-4" /> Back
                                        </Button>
                                        <div className="flex gap-3">
                                            <Button type="button" variant="ghost" onClick={() => navigate("/problems")}>
                                                Cancel
                                            </Button>
                                            <Button type="submit" disabled={loading} className="min-w-[150px]">
                                                {loading ? "Creating..." : (
                                                    <>
                                                        <Save className="w-4 h-4 mr-2" /> Publish Problem
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default CreateProblem;
