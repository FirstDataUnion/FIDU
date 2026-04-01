import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Icon,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Pending as PendingIcon,
  Loop as InProgressIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useCallback, useEffect, useState } from 'react';
import WizardChoiceScreen from './WizardChoiceScreen';
import { DrivePicker } from '../../services/drive/DrivePicker';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import type { ContextCorpus } from '../../types';
import { useAppDispatch } from '../../store';
import { useAppSelector } from '../../hooks/redux';
import { selectCurrentProfile } from '../../store/selectors/conversationsSelectors';
import { createContextCorpus } from '../../store/slices/contextsSlice';
import { createRagApiClient } from '../../services/api/apiClientRag';

type Steps =
  | 'corpus_type'
  | 'corpus_location'
  | 'corpus_drive_location'
  | 'corpus_name_description'
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

function CorpusNameDescriptionStep({
  onNext,
}: {
  onNext: (name: string, description: string) => void;
}) {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  return (
    <Box>
      <TextField
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <TextField
        label="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <Button
        disabled={!name.trim() || !description.trim()}
        onClick={() => onNext(name, description)}
      >
        Next
      </Button>
    </Box>
  );
}

function CreateCorpusStep({
  corpusType,
  corpusLocation,
  corpusDriveLocation,
  corpusInfo,
  onClose,
}: {
  corpusType: CorpusType;
  corpusLocation: CorpusLocation;
  corpusDriveLocation: { folderId?: string; fileName: string };
  corpusInfo: { name: string; description: string };
  onClose: (createdCorpus?: ContextCorpus) => void;
}) {
  const steps = ['create_empty_drive_file', 'initialise_corpus'] as const;
  type CorpusCreationStep = (typeof steps)[number];
  type StepProgressStatus = 'pending' | 'in_progress' | 'completed' | 'error';
  const labels: Readonly<Record<CorpusCreationStep, string>> = {
    create_empty_drive_file: 'Creating empty drive file',
    initialise_corpus: 'Initialising corpus',
  };
  const [stepsProgress, setStepsProgress] = useState<
    Record<CorpusCreationStep, StepProgressStatus>
  >({
    create_empty_drive_file: 'pending',
    initialise_corpus: 'pending',
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdCorpus, setCreatedCorpus] = useState<ContextCorpus | undefined>(
    undefined
  );
  const dispatch = useAppDispatch();
  const currentProfile = useAppSelector(selectCurrentProfile);

  useEffect(() => {
    setIsCreating(
      Object.values(stepsProgress).reduce(
        (acc, status) => acc || status === 'in_progress',
        false
      )
    );
  }, [stepsProgress]);

  useEffect(() => {
    setIsCreated(
      Object.values(stepsProgress).reduce(
        (acc, status) => acc || status === 'completed',
        false
      )
    );
  }, [stepsProgress]);

  const createEmptyDriveFile = useCallback(async (): Promise<string> => {
    const authService = await getGoogleDriveAuthService();
    const accessToken = await authService.getAccessToken();
    const metadata: {
      name: string;
      mimeType: string;
      parents?: string[];
    } = {
      name: corpusDriveLocation.fileName,
      mimeType: 'application/octet-stream',
    };
    if (corpusDriveLocation.folderId) {
      metadata.parents = [corpusDriveLocation.folderId];
    }
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create empty Drive file: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    const data: { id?: string } = await response.json();
    const fileId = data.id;
    if (!fileId) {
      throw new Error('Drive did not return a created file ID');
    }
    return fileId;
  }, [corpusDriveLocation.fileName, corpusDriveLocation.folderId]);

  const handleCreate = useCallback(async () => {
    console.log(
      'Creating corpus',
      corpusType,
      corpusLocation,
      corpusDriveLocation
    );

    setStepsProgress({
      create_empty_drive_file: 'in_progress',
      initialise_corpus: 'pending',
    });
    if (!currentProfile?.id) {
      throw new Error('No profile ID found');
    }
    const fileId = await createEmptyDriveFile();
    const result = await dispatch(
      createContextCorpus({
        data: {
          name: corpusInfo.name,
          description: corpusInfo.description,
          database: {
            type: corpusType,
            location: {
              type: corpusLocation,
              fileId,
              mimeType: 'application/octet-stream',
            },
          },
          documents: [],
          urls: [],
          tags: [],
        },
        profileId: currentProfile.id,
      })
    );
    if (createContextCorpus.fulfilled.match(result)) {
      setCreatedCorpus(result.payload);
      setStepsProgress(prev => ({
        ...prev,
        create_empty_drive_file: 'completed',
      }));
    } else {
      setStepsProgress(prev => ({ ...prev, create_empty_drive_file: 'error' }));
      throw new Error(
        (typeof result.payload === 'string' && result.payload)
          || result.error.message
          || 'Failed to create corpus'
      );
    }

    setStepsProgress(prev => ({ ...prev, initialise_corpus: 'in_progress' }));
    try {
      const ragApiClient = createRagApiClient();
      await ragApiClient.initialiseCorpus({
        provider: 'fidu_rag',
        engine: corpusType,
        location: {
          provider: 'google_drive',
          fileId,
        },
      });
      setStepsProgress(prev => ({ ...prev, initialise_corpus: 'completed' }));
    } catch (error) {
      setStepsProgress(prev => ({ ...prev, initialise_corpus: 'error' }));
      throw error;
    }
  }, [
    corpusType,
    corpusLocation,
    corpusDriveLocation,
    currentProfile?.id,
    createEmptyDriveFile,
    dispatch,
    corpusInfo.name,
    corpusInfo.description,
  ]);

  return (
    <Box>
      <Typography variant="h6">Summary</Typography>
      <Typography variant="body1">Corpus type: {corpusType}</Typography>
      <Typography variant="body1">Corpus location: {corpusLocation}</Typography>
      <Typography variant="body1">
        Corpus Drive location: {corpusDriveLocation.fileName} in{' '}
        {corpusDriveLocation.folderId ?? 'root'}
      </Typography>
      <Typography variant="body1">Corpus name: {corpusInfo.name}</Typography>
      <Typography variant="body1">
        Corpus description: {corpusInfo.description}
      </Typography>
      {(isCreating || isCreated) && (
        <Stack direction="column" spacing={2} sx={{ mt: 2 }}>
          {steps.map(step => (
            <Stack direction="row" spacing={1} key={step}>
              <Icon
                color={
                  stepsProgress[step] === 'error'
                    ? 'error'
                    : stepsProgress[step] === 'completed'
                      ? 'success'
                      : 'secondary'
                }
              >
                {
                  {
                    pending: <PendingIcon />,
                    in_progress: <InProgressIcon />,
                    completed: <CompletedIcon />,
                    error: <ErrorIcon />,
                  }[stepsProgress[step]]
                }
              </Icon>
              <Typography sx={{ pt: 0.3 }} variant="body1">
                {labels[step]}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {isCreated ? (
          <>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => onClose(createdCorpus)}
            >
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
  onClose: (createdCorpus?: ContextCorpus) => void;
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
  const [corpusInfo, setCorpusInfo] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: '',
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
      setStep('corpus_name_description');
    },
    [setStep]
  );

  const handleCorpusNameDescriptionNext = useCallback(
    (name: string, description: string) => {
      setCorpusInfo({ name, description });
      setStep('create_corpus');
    },
    [setStep, setCorpusInfo]
  );

  const handleClose = useCallback(
    (createdCorpus?: ContextCorpus) => {
      onClose(createdCorpus);
      reset();
    },
    [reset, onClose]
  );

  return (
    <Dialog open={open} onClose={() => handleClose()}>
      <DialogTitle>Add New Context Corpus</DialogTitle>
      <DialogContent>
        {step === 'corpus_type' ? (
          <CorpusTypeStep onNext={handleCorpusTypeNext} />
        ) : step === 'corpus_location' ? (
          <CorpusLocationStep onNext={handleCorpusLocationNext} />
        ) : step === 'corpus_drive_location' ? (
          <CorpusDriveLocationStep onNext={handleCorpusDriveLocationNext} />
        ) : step === 'corpus_name_description' ? (
          <CorpusNameDescriptionStep onNext={handleCorpusNameDescriptionNext} />
        ) : step === 'create_corpus' ? (
          <CreateCorpusStep
            corpusType={corpusType}
            corpusLocation={corpusLocation}
            corpusDriveLocation={corpusDriveLocation}
            corpusInfo={corpusInfo}
            onClose={handleClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
