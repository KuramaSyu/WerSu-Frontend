import { Card, CardContent, Typography } from "@mui/material";
import type { MinimalNote } from "../../api/SearchNotesApi";
import { M2, M3, M4 } from "../../statics";

export const NoteCard: React.FC<{note: MinimalNote}> = ({note}) => {
    return (
        <Card sx={{ minWidth: '4rem' }} variant="outlined">
            <CardContent>
                <Typography variant="subtitle2" mb={M2}>
                    {note.updated_at}
                </Typography>
                <Typography variant="h5" gutterBottom>
                    {note.title}
                </Typography>
                <Typography variant="body2">
                    {note.stripped_content}
                </Typography>
            </CardContent>
        </Card>
    );
};
