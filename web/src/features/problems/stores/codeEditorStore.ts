import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CodeEditorState {

  savedCodes: Record<string, Record<string, string>>;


  saveCode: (problemId: string, language: string, code: string) => void;
  getSavedCode: (problemId: string, language: string) => string | undefined;
  clearCode: (problemId: string, language: string) => void;
  clearAll: () => void;
}

export const useCodeEditorStore = create<CodeEditorState>()(
  persist(
    (set, get) => ({
      savedCodes: {},

      saveCode: (problemId, language, code) =>
        set((state) => ({
          savedCodes: {
            ...state.savedCodes,
            [problemId]: {
              ...(state.savedCodes[problemId] || {}),
              [language]: code,
            },
          },
        })),

      getSavedCode: (problemId, language) => {
        return get().savedCodes[problemId]?.[language];
      },

      clearCode: (problemId, language) =>
        set((state) => {
          if (!state.savedCodes[problemId]) return state;

          const { [language]: _, ...restLanguages } =
            state.savedCodes[problemId];

          return {
            savedCodes: {
              ...state.savedCodes,
              [problemId]: restLanguages,
            },
          };
        }),

      clearAll: () => set({ savedCodes: {} }),
    }),
    {
      name: 'code-editor-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
