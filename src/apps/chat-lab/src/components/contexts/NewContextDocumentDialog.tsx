import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { useAppDispatch } from '../../store';
import { selectCurrentProfile } from '../../store/selectors/conversationsSelectors';
import { useAppSelector } from '../../hooks/redux';
import { createContext } from '../../store/slices/contextsSlice';
import CreateContextDialog from './CreateContextDialog';
import type { ContextFormData } from '../../types/contexts';

const optionStyle = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  '&.Mui-selected': {
    borderColor: 'primary.main',
  },
};

type DocumentType = 'fidu' | 'google_drive';
function DocumentTypeStep({
  onNext,
}: {
  onNext: (documentType: DocumentType) => void;
}) {
  const [selectedDocumentType, setSelectedDocumentType] = useState<
    DocumentType | undefined
  >(undefined);

  const handleNext = useCallback(() => {
    setSelectedDocumentType(undefined);
    if (!selectedDocumentType) {
      console.error('Next pressed with no document type selected');
      return;
    }
    onNext(selectedDocumentType);
  }, [setSelectedDocumentType, onNext, selectedDocumentType]);

  return (
    <>
      <Box>
        <Typography>Choose type of document to add</Typography>
        <List disablePadding sx={{ mt: 2 }}>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={selectedDocumentType === 'fidu'}
              onClick={() => setSelectedDocumentType('fidu')}
              sx={optionStyle}
            >
              <ListItemText
                primary={<Typography variant="h6">FIDU Document</Typography>}
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Stored in your FIDU Vault, alongside your conversations.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A Markdown document managed entirely within ChatLab.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedDocumentType === 'google_drive'}
              onClick={() => setSelectedDocumentType('google_drive')}
              sx={optionStyle}
            >
              <ListItemText
                primary={
                  <Typography variant="h6">Google Drive Document</Typography>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Stored as a normal file in your Google Drive.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Larger variety of file types supported, including PDFs and
                      Google Docs.
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          </ListItem>
        </List>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedDocumentType}
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
  );
}

function CreateFiduContextStep({
  onCreate,
  onClose,
}: {
  onCreate: (form: ContextFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ContextFormData>({
    title: '',
    body: '',
    tags: [],
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
    onCreate(form);
  }, [form, onCreate]);

  const handleClose = useCallback(() => {
    setIsCreating(false);
    onClose();
  }, [onClose]);

  return (
    <CreateContextDialog
      form={form}
      onFormChange={setForm}
      onCreate={handleCreate}
      onClose={handleClose}
      isCreating={isCreating}
      open={true}
    />
  );
}

export default function NewContextDocumentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  type Steps = 'document_type' | 'create_fidu_context';
  const [step, setStep] = useState<Steps>('document_type');
  const [selectedDocumentType, setSelectedDocumentType] = useState<
    'fidu' | 'google_drive' | undefined
  >(undefined);
  const [googleDriveDocumentTitle, setGoogleDriveDocumentTitle] = useState<
    string | undefined
  >(undefined);
  const dispatch = useAppDispatch();
  const currentProfile = useAppSelector(selectCurrentProfile);

  const resetState = useCallback(() => {
    setStep('document_type');
    setSelectedDocumentType(undefined);
    setGoogleDriveDocumentTitle(undefined);
  }, [setStep, setSelectedDocumentType, setGoogleDriveDocumentTitle]);

  const handleDocumentTypeNext = useCallback(
    (documentType: DocumentType) => {
      setSelectedDocumentType(documentType);
      if (documentType === 'fidu') {
        setStep('create_fidu_context');
      } else {
        setStep('google_drive_document_title');
      }
    },
    [setSelectedDocumentType]
  );

  const handleFiduDocumentCreate = useCallback(
    async (form: ContextFormData) => {
      if (!currentProfile?.id) {
        console.error('No profile ID found');
        return;
      }
      await dispatch(
        createContext({
          contextData: form,
          profileId: currentProfile.id,
        })
      );
      resetState();
      onClose();
    },
    [resetState, onClose, currentProfile?.id, dispatch]
  );

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add New Context Document</DialogTitle>
      <DialogContent>
        {step === 'document_type' ? (
          <DocumentTypeStep onNext={handleDocumentTypeNext} />
        ) : step === 'create_fidu_context' ? (
          <CreateFiduContextStep onCreate={handleFiduDocumentCreate} onClose={handleClose} />
        ) : step === 'google_drive_document_title' ? (
          <GoogleDriveDocumentTitleStep onNext={setGoogleDriveDocumentTitle} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
