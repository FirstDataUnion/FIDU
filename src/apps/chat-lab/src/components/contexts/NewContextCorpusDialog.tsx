import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import WizardChoiceScreen from './WizardChoiceScreen';
import { DrivePicker } from '../../services/drive/DrivePicker';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import type { ContextCorpus } from '../../types';

type Steps =
  | 'corpus_type'
  | 'corpus_location'
  | 'corpus_drive_location'
  | 'create_corpus';
type CorpusType = 'cortexdb';
type CorpusLocation = 'google_drive';

function CorpusTypeStep({
  onNext,
}: {
  onNext: (corpusType: CorpusType) => void;
}) {
  return (
    <WizardChoiceScreen
      title="Choose type of corpus to add"
      choices={[
        {
          label: 'CortexDB',
          description: [
            <>
              All your corpus data, stored in one file, in a location of your
              choice (e.g. Google Drive, Dropbox, etc.).
            </>,
            <>
              The file is downloaded to FIDU servers when you request an action
              that requires it but kept there only as long as necessary to
              perform the action (plus a small amount of time for caching).
            </>,
            <>
              The file is not encrypted and contains all the data from with
              access to the file can read data from any source file, no matter
              where the original file is stored or whether it is encrypted or
              not.
            </>,
          ],
          value: 'cortexdb',
        },
      ]}
      onChoiceMade={onNext}
    />
  );
}

function CorpusLocationStep({
  onNext,
}: {
  onNext: (corpusLocation: CorpusLocation) => void;
}) {
  return (
    <WizardChoiceScreen
      title="Choose location of corpus"
      choices={[
        { label: 'Google Drive', description: [], value: 'google_drive' },
      ]}
      onChoiceMade={onNext}
    />
  );
}

function CorpusDriveLocationStep({
  onNext,
}: {
  onNext: (location: {
    folderId: string | undefined;
    fileName: string;
  }) => void;
}) {
  const defaultFileName = 'fidu.db';
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);

  const handleNext = useCallback(() => {
    onNext({ folderId, fileName: fileName ?? defaultFileName });
  }, [folderId, fileName, onNext]);

  const openPicker = useCallback(async () => {
    const authService = await getGoogleDriveAuthService();
    const drivePicker = new DrivePicker({ authService });
    const { folderId } = await drivePicker.pickFolder();
    setFolderId(folderId);
  }, [setFolderId]);

  return (
    <>
      <Box>
        <Typography sx={{ mb: 1 }}>Choose file name</Typography>
        <TextField
          label="File name"
          slotProps={{ inputLabel: { shrink: true } }}
          value={fileName}
          placeholder={defaultFileName}
          onChange={e => setFileName(e.target.value)}
          helperText="The name of the database file for your corpus in Google Drive."
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        <Typography>Choose location of corpus</Typography>
        <Typography variant="body2" color="text.secondary">
          If you'd like the corpus to be stored in a specific folder, you can
          choose it here.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {folderId
            ? `Folder: ${folderId}`
            : 'Otherwise, it will be stored in the root of your Google Drive.'}
        </Typography>
        <Button onClick={openPicker}>Choose folder</Button>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" color="primary" onClick={handleNext}>
          Next
        </Button>
      </Box>
    </>
  );
}

function CreateCorpusStep({
  corpusType,
  corpusLocation,
  corpusDriveLocation,
  onClose,
}: {
  corpusType: CorpusType;
  corpusLocation: CorpusLocation;
  corpusDriveLocation: { folderId?: string; fileName: string };
  onClose: () => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdCorpus, setCreatedCorpus] = useState<ContextCorpus | undefined>(
    undefined
  );

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    console.log(
      'Creating corpus',
      corpusType,
      corpusLocation,
      corpusDriveLocation
    );
    try {
      // TODO
      // const corpus = await dispatch(somethingThatTakesAWhile());
      // setCreatedCorpus(corpus);
    } finally {
      setIsCreating(false);
    }
  }, [corpusType, corpusLocation, corpusDriveLocation]);

  return (
    <Box>
      <Typography variant="h6">Summary</Typography>
      <Typography variant="body1">Corpus type: {corpusType}</Typography>
      <Typography variant="body1">Corpus location: {corpusLocation}</Typography>
      <Typography variant="body1">
        Corpus Drive location: {corpusDriveLocation.fileName} in{' '}
        {corpusDriveLocation.folderId ?? 'root'}
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {createdCorpus ? (
          <>
            <Typography variant="body1">
              Corpus created: {createdCorpus.name}
            </Typography>
            <Button variant="outlined" color="primary" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            color="primary"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default function NewContextCorpusDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Steps>('corpus_type');
  const [corpusType, setCorpusType] = useState<CorpusType>('cortexdb');
  const [corpusLocation, setCorpusLocation] =
    useState<CorpusLocation>('google_drive');
  const [corpusDriveLocation, setCorpusDriveLocation] = useState<{
    folderId?: string;
    fileName: string;
  }>({
    folderId: undefined,
    fileName: 'fidu.db',
  });

  const reset = useCallback(() => {
    setStep('corpus_type');
    setCorpusType('cortexdb');
    setCorpusLocation('google_drive');
    setCorpusDriveLocation({ folderId: undefined, fileName: 'fidu.db' });
  }, [setStep, setCorpusType, setCorpusLocation, setCorpusDriveLocation]);

  const handleCorpusTypeNext = useCallback(
    (corpusType: CorpusType) => {
      setCorpusType(corpusType);
      setStep({ cortexdb: 'corpus_location' as const }[corpusType]);
    },
    [setStep, setCorpusType]
  );

  const handleCorpusLocationNext = useCallback(
    (corpusLocation: CorpusLocation) => {
      setCorpusLocation(corpusLocation);
      setStep(
        { google_drive: 'corpus_drive_location' as const }[corpusLocation]
      );
    },
    [setStep, setCorpusLocation]
  );

  const handleCorpusDriveLocationNext = useCallback(
    (location: { folderId: string | undefined; fileName: string }) => {
      setCorpusDriveLocation(location);
      setStep('create_corpus');
    },
    [setStep]
  );

  const handleClose = useCallback(() => {
    onClose();
    reset();
  }, [reset, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add New Context Corpus</DialogTitle>
      <DialogContent>
        {step === 'corpus_type' ? (
          <CorpusTypeStep onNext={handleCorpusTypeNext} />
        ) : step === 'corpus_location' ? (
          <CorpusLocationStep onNext={handleCorpusLocationNext} />
        ) : step === 'corpus_drive_location' ? (
          <CorpusDriveLocationStep onNext={handleCorpusDriveLocationNext} />
        ) : step === 'create_corpus' ? (
          <CreateCorpusStep
            corpusType={corpusType}
            corpusLocation={corpusLocation}
            corpusDriveLocation={corpusDriveLocation}
            onClose={handleClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
