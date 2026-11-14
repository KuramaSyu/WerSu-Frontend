import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  IconAlertTriangle,
  IconExternalLink,
  IconLink,
} from "@tabler/icons-react";
import { generateHTML } from "@tiptap/core";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Modal } from "../../Modal";
import { useActiveNoteStore } from "../../../zustand/editorStore";
import {
  useNote,
  useReferenceTargetNote,
} from "../../../api/queries/useNoteQueries";
import { UserError } from "../../../api/models/UserError";
import {
  buildNoteReferenceHref,
  extractNoteSections,
  findNoteReference,
  findNoteSection,
  formatNoteReferenceToken,
  isNoteReferenceAccessDenied,
  normalizeNoteSectionSlug,
} from "../../../utils/noteReferences";

/**
 * Inline pill for a `{{@note-id#section}}` token.
 *
 * The primary note is fetched with `include_references=true`, so
 * saved references come from its provided `references` payload. The
 * referenced note is only fetched when that payload is missing/empty
 * (e.g. a reference just inserted or edited) or when the modal needs
 * the full note to list its sections. The document always keeps the
 * raw token; resolved content is never written back into
 * `note.content`.
 */
export function NoteReferenceNodeView({
  node,
  editor,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const rawNoteId = String(node.attrs.noteId ?? "");
  const rawSection = String(node.attrs.section ?? "");
  const [open, setOpen] = useState(false);
  const [draftNoteId, setDraftNoteId] = useState(rawNoteId);
  const [draftSection, setDraftSection] = useState(rawSection);

  const canEdit = editor.isEditable;

  // The primary note owns the backend-resolved references. Prefer that
  // payload; only fetch the target when it is absent/empty or when the
  // modal needs the full note for section autocomplete.
  const parentNoteId = useActiveNoteStore((s) => s.noteId);
  const parentNoteQuery = useNote(parentNoteId, undefined, true);
  const parentNote = parentNoteQuery.data;

  // While the modal is open, preview edits immediately. Otherwise use
  // the saved node attrs.
  const activeNoteId = (open ? draftNoteId : rawNoteId).trim();
  const activeSection = normalizeNoteSectionSlug(
    open ? draftSection : rawSection,
  );

  const providedReference = findNoteReference(
    parentNote?.references,
    activeNoteId,
    activeSection,
  );
  const providedContent = providedReference?.content ?? "";
  const providedAccessDenied =
    isNoteReferenceAccessDenied(providedContent);
  const hasProvidedContent =
    providedContent.trim().length > 0 && !providedAccessDenied;

  const parentResolutionPending =
    !!parentNoteId && parentNoteQuery.isFetching && !parentNote;
  const needsTargetFetch =
    !!activeNoteId &&
    !parentResolutionPending &&
    !providedAccessDenied &&
    (!hasProvidedContent || (open && activeSection.length > 0));

  const targetQuery = useReferenceTargetNote(
    activeNoteId || undefined,
    needsTargetFetch,
  );
  const targetNote = targetQuery.data;

  // For autocomplete we need the full note. Fall back to the provided
  // content while the target fetch (when needed) is in flight.
  const sectionsMarkdown = targetNote?.content ?? providedContent;
  const sections = extractNoteSections(sectionsMarkdown);

  const sectionSuggestions = (() => {
    if (!draftSection.startsWith("#")) return [];
    const query = normalizeNoteSectionSlug(draftSection).toLowerCase();
    return sections
      .filter(
        (section) =>
          query.length === 0 ||
          section.slug.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query),
      )
      .slice(0, 20);
  })();

  const fallbackSection =
    targetNote && activeSection
      ? findNoteSection(targetNote.content, activeSection)
      : undefined;

  const fallbackContent = targetNote
    ? activeSection
      ? fallbackSection?.content ?? null
      : targetNote.content
    : null;

  const resolvedContent = providedAccessDenied
    ? null
    : hasProvidedContent
      ? providedContent
      : fallbackContent;

  const renderedHtml = useMemo(() => {
    if (resolvedContent === null) return "";
    try {
      const manager = editor.storage.markdown?.manager;
      if (!manager) return "";
      const json = manager.parse(resolvedContent);
      return generateHTML(json, editor.extensionManager.baseExtensions);
    } catch {
      // Fall back to escaped text if the content cannot be parsed.
      return resolvedContent
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    }
  }, [editor, resolvedContent]);

  const sectionMissing =
    !hasProvidedContent &&
    !!targetNote &&
    activeSection.length > 0 &&
    !fallbackSection;

  const accessDenied =
    providedAccessDenied ||
    (targetQuery.error instanceof UserError &&
      (targetQuery.error.status === 401 ||
        targetQuery.error.status === 403));

  const isLoadingTarget =
    !hasProvidedContent &&
    !providedAccessDenied &&
    (parentResolutionPending ||
      (needsTargetFetch && targetQuery.isFetching && !targetNote));

  useEffect(() => {
    if (!activeNoteId) return;
    if (providedAccessDenied) {
      console.debug("[note-reference] resolved from provided references", {
        noteId: activeNoteId,
        section: activeSection,
        source: "include_references",
        accessDenied: true,
      });
      return;
    }
    if (hasProvidedContent) {
      console.debug("[note-reference] resolved from provided references", {
        noteId: activeNoteId,
        section: activeSection,
        source: "include_references",
        contentLength: providedContent.length,
      });
      return;
    }
    if (targetNote) {
      console.debug("[note-reference] resolved by fetching referenced note", {
        noteId: activeNoteId,
        section: activeSection,
        source: "fetch",
        contentLength: (fallbackContent ?? "").length,
      });
      return;
    }
    if (targetQuery.isError) {
      console.debug("[note-reference] referenced note fetch failed", {
        noteId: activeNoteId,
        section: activeSection,
        source: "fetch",
      });
    }
  }, [
    activeNoteId,
    activeSection,
    fallbackContent,
    hasProvidedContent,
    providedAccessDenied,
    providedContent.length,
    targetNote,
    targetQuery.isError,
  ]);

  const openModal = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDraftNoteId(rawNoteId);
    setDraftSection(rawSection);
    setOpen(true);
  };

  const token = formatNoteReferenceToken(rawNoteId, rawSection);
  const href = buildNoteReferenceHref(
    draftNoteId.trim(),
    normalizeNoteSectionSlug(draftSection),
  );

  const label = rawSection ? `@${rawNoteId}#${rawSection}` : `@${rawNoteId}`;

  const handleSave = () => {
    const nextNoteId = draftNoteId.trim();
    const nextSection = normalizeNoteSectionSlug(draftSection);
    if (!nextNoteId) return;
    updateAttributes({ noteId: nextNoteId, section: nextSection });
    setOpen(false);
  };

  // Shared by the inline preview and the modal. `canEdit` controls
  // whether the loading state is visible (read mode stays quiet until
  // content is available).
  const resolvedBody = isLoadingTarget ? (
    canEdit ? (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <CircularProgress size={16} />
        <Typography variant="body2">Loading referenced note...</Typography>
      </Stack>
    ) : null
  ) : accessDenied ? (
    <Alert
      severity="error"
      icon={<IconAlertTriangle size={20} />}
      data-testid="note-reference-access-denied"
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Access denied
      </Typography>
      <Typography variant="body2">
        {canEdit
          ? "You do not have permission to view this referenced note. The reference stays in the note."
          : "You do not have permission to view this note."}
      </Typography>
    </Alert>
  ) : targetQuery.isError ? (
    <Alert severity="error" icon={<IconAlertTriangle size={20} />}>
      {canEdit ? "Could not load the referenced note." : "Could not load this note."}
    </Alert>
  ) : sectionMissing ? (
    <Typography variant="body2" color="textSecondary">
      No section named “{activeSection}” exists in this note.
    </Typography>
  ) : resolvedContent !== null ? (
    <Box
      sx={{
        p: canEdit ? 1.5 : 0,
        border: canEdit ? 1 : 0,
        borderColor: canEdit ? "divider" : "transparent",
        borderRadius: canEdit ? 1 : 0,
        backgroundColor: canEdit ? "action.hover" : "transparent",
        maxHeight: canEdit ? 240 : undefined,
        overflowY: canEdit ? "auto" : undefined,
        overflowX: canEdit ? "auto" : undefined,
        wordBreak: "break-word",
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& h1, & h2, & h3, & h4, & h5, & h6": {
          mt: 1.25,
          mb: 0.5,
          lineHeight: 1.3,
        },
        "& h1": { fontSize: "1.4rem" },
        "& h2": { fontSize: "1.2rem" },
        "& h3": { fontSize: "1.05rem" },
        "& p": { my: 0.5, lineHeight: 1.6 },
        "& ul, & ol": { pl: 3, my: 0.5 },
        "& li": { my: 0.25 },
        "& table": { width: "100%", borderCollapse: "collapse", my: 1 },
        "& th, & td": {
          border: 1,
          borderColor: "divider",
          p: 0.75,
          textAlign: "left",
          verticalAlign: "top",
        },
        "& img": { maxWidth: "100%", height: "auto" },
        "& pre": {
          overflowX: "auto",
          p: 1,
          borderRadius: 1,
          // ThemedEditorBox's static-`pre` rule paints background.paper;
          // force the same background.default used by live code blocks.
          backgroundColor: (theme) =>
            `${theme.palette.background.default} !important`,
        },
        "& code": { fontFamily: "monospace" },
        "& a": { color: "primary.main" },
        "& blockquote": {
          borderLeft: 3,
          borderColor: "divider",
          pl: 1.5,
          ml: 0,
          color: "text.secondary",
        },
      }}
      data-testid="note-reference-content"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  ) : canEdit ? (
    <Typography variant="body2" color="textSecondary">
      No resolved content is available for this reference.
    </Typography>
  ) : null;

  return (
    <NodeViewWrapper
      as="span"
      data-note-reference=""
      contentEditable={false}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        verticalAlign: "top",
        maxWidth: "100%",
      }}
    >
      {canEdit && (
        <Tooltip title={`Note reference ${token} - click to inspect`}>
          <Chip
            component="span"
            size="small"
            icon={<IconLink size={14} />}
            label={label}
            onClick={openModal}
            data-testid="note-reference-chip"
            sx={{
              alignSelf: "flex-start",
              mb: 0.5,
              mx: 0.25,
              verticalAlign: "baseline",
              cursor: "pointer",
              border: 1,
              borderColor: selected ? "primary.main" : "divider",
              backgroundColor: "action.hover",
              "& .MuiChip-icon": { color: "primary.main" },
              "& .MuiChip-label": { fontFamily: "monospace" },
            }}
          />
        </Tooltip>
      )}

      {resolvedBody}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        ariaLabelledBy="note-reference-modal-title"
      >
        <Modal.Header
          icon={<IconLink size={24} />}
          title="Note reference"
          subtitle={token}
        />
        <Modal.Body>
          <Stack spacing={2}>
            <Typography variant="body2" color="textSecondary">
              The reference token is stored in the note as-is. Changing the
              target below updates the token when the note is saved.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: "flex-start" }}
            >
              <TextField
                label="Note id"
                value={draftNoteId}
                onChange={(event) => setDraftNoteId(event.target.value)}
                disabled={!canEdit}
                fullWidth
                size="small"
                slotProps={{
                  htmlInput: { "data-testid": "note-reference-id-input" },
                }}
              />
              <Box sx={{ width: "100%", position: "relative" }}>
                <TextField
                  label="Section slug (optional)"
                  value={draftSection}
                  onChange={(event) => setDraftSection(event.target.value)}
                  disabled={!canEdit}
                  fullWidth
                  size="small"
                  placeholder="whole note"
                  helperText="Type # to pick a heading in the referenced note."
                  slotProps={{
                    htmlInput: {
                      "data-testid": "note-reference-section-input",
                    },
                  }}
                />
                {draftSection.startsWith("#") && (
                  <Paper
                    variant="outlined"
                    sx={{
                      position: "absolute",
                      zIndex: 2,
                      left: 0,
                      right: 0,
                      mt: 0.5,
                      maxHeight: 180,
                      overflowY: "auto",
                    }}
                  >
                    <List dense disablePadding>
                      {sectionSuggestions.map((section) => (
                        <ListItemButton
                          key={section.slug}
                          onClick={() => setDraftSection(section.slug)}
                        >
                          <ListItemText primary={section.title} />
                        </ListItemButton>
                      ))}
                      {sectionSuggestions.length === 0 && (
                        <ListItemButton disabled>
                          <ListItemText
                            primary={
                              isLoadingTarget
                                ? "Loading sections..."
                                : "No matching sections"
                            }
                          />
                        </ListItemButton>
                      )}
                    </List>
                  </Paper>
                )}
              </Box>
            </Stack>

            <Box>
              <Typography variant="caption" color="textSecondary">
                Link
              </Typography>
              <Typography
                variant="body2"
                component="a"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  wordBreak: "break-all",
                }}
              >
                {href}
                <IconExternalLink size={14} />
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="textSecondary">
                Resolved content
              </Typography>
              <Box sx={{ mt: 1 }}>{resolvedBody}</Box>
            </Box>
          </Stack>
        </Modal.Body>
        <Modal.Footer align="space-between">
          <Typography variant="caption" color="textSecondary">
            {canEdit
              ? "Editing the reference changes the token."
              : "Read-only"}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!canEdit || draftNoteId.trim().length === 0}
              data-testid="note-reference-save"
            >
              Save changes
            </Button>
          </Stack>
        </Modal.Footer>
      </Modal>
    </NodeViewWrapper>
  );
}