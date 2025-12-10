export interface MinimalNote {
  id: number;
  title: string;
  author_id: number;
  updated_at: string; // Or Date, depending on how it's deserialized
  stripped_content: string;
}

export interface SearchNotesApi {
    search(query: string, search_type: string, limit?: number, offset?: number): Promise<MinimalNote[]>;
};

export class TestSearchNotesApi implements SearchNotesApi {
    async search(query: string, search_type: string, limit: number = 10, offset: number = 0): Promise<MinimalNote[]> {
        // Returns 30 dummy notes for testing
        const results: MinimalNote[] = [];
        for (let i = 0; i < 30; i++) {
            results.push({
                id: i + 1,
                title: `Test Note ${i + 1}`,
                author_id: 1,
                updated_at: new Date().toISOString(),
                stripped_content: `This is the content of Test Note ${i + 1}`,
            });
        }
        return results;
    }
}
