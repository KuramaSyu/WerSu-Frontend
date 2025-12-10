import { Card, CardContent, Typography } from "@mui/material";
import type { MinimalNote } from "../../api/SearchNotesApi";
import { M2, M3, M4 } from "../../statics";
import { useThemeStore } from "../../zustand/useThemeStore";
import { blendWithContrast } from "../../utils/blendWithContrast";

export const NoteCard: React.FC<{note: MinimalNote}> = ({note}) => {
    const {theme} = useThemeStore();
    return (
        <Card sx={{ minWidth: '4rem' }} variant="outlined">
            <CardContent>
                <Typography variant="subtitle2" mb={M3} color={blendWithContrast(theme.palette.text.primary, theme, 1/4)}>
                    {note.updated_at}
                </Typography>
                <Typography variant="h5" gutterBottom>
                    {note.title}
                </Typography>
                <Typography variant="body2" color={theme.palette.text.secondary} sx={{ whiteSpace: 'pre-wrap' }}>
                    {note.stripped_content}
                </Typography>
            </CardContent>
        </Card>
    );
};
