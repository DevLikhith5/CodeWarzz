import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavbar } from "@/components/app/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import api from "@/lib/api";
import { Plus, Trash2, Save } from "lucide-react";

interface TestCase {
    input: string;
    output: string;
    isSample: boolean;
}

const CreateProblem = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        difficulty: "EASY",
        slug: "",
        tags: "", // Comma separated
        hints: "", // Comma separated or new line
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

    return (
        <div className="min-h-screen bg-background">
            <AppNavbar />
            <main className="container mx-auto px-4 py-24 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                        Create New Problem
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Add a new challenge to the CodeWarz platform.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Problem Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description (Markdown)</label>
                                <Textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Describe the problem..."
                                    className="min-h-[200px] font-mono"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tags (comma separated)</label>
                                    <Input
                                        name="tags"
                                        value={formData.tags}
                                        onChange={handleInputChange}
                                        placeholder="Array, Hash Table"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Hints (one per line)</label>
                                    <Textarea
                                        name="hints"
                                        value={formData.hints}
                                        onChange={handleInputChange}
                                        placeholder="Use a map to store..."
                                        className="h-10 min-h-[40px]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Test Cases */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Test Cases</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
                                <Plus className="w-4 h-4 mr-2" /> Add Case
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {testCases.map((tc, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4 border rounded-lg bg-card/50">
                                    <div className="md:col-span-5 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Input</label>
                                        <Textarea
                                            value={tc.input}
                                            onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                                            placeholder="1 2"
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-5 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Output</label>
                                        <Textarea
                                            value={tc.output}
                                            onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                                            placeholder="3"
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-2 flex flex-col gap-4 items-center justify-center h-full pt-6">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`sample-${index}`}
                                                checked={tc.isSample}
                                                onChange={(e) => handleTestCaseChange(index, "isSample", e.target.checked)}
                                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label htmlFor={`sample-${index}`} className="text-xs">Sample</label>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:bg-destructive/10"
                                            onClick={() => removeTestCase(index)}
                                            disabled={testCases.length === 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="ghost" onClick={() => navigate("/problems")}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="min-w-[150px]">
                            {loading ? "Creating..." : (
                                <>
                                    <Save className="w-4 h-4 mr-2" /> Create Problem
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default CreateProblem;
