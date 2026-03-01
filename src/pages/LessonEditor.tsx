import { useEffect, useMemo, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { darken, lighten, getLuminance } from '@mui/system';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import VideocamIcon from '@mui/icons-material/Videocam';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, storage } from '../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import RichTextEditor from '../components/RichTextEditor';
import VideoRecorder from '../components/VideoRecorder';
import VideoEditor from '../components/VideoEditor';
import { useNavigation } from '../context/NavigationContext';

const getStatusStyles = (brandColor: string) => ({
  published: {
    label: 'Veröffentlicht',
    dot: '#22c55e',
    color: brandColor,
    chipBg: 'rgba(34, 197, 94, 0.15)',
    chipText: '#15803d',
  },
  draft: {
    label: 'Entwurf',
    dot: brandColor,
    color: brandColor,
    chipBg: `${brandColor}20`,
    chipText: brandColor,
  },
  disabled: {
    label: 'Deaktiviert',
    dot: '#ef4444',
    color: brandColor,
    chipBg: 'rgba(239, 68, 68, 0.15)',
    chipText: '#b91c1c',
  },
} as const);

type LessonStatus = 'published' | 'draft' | 'disabled';
type LessonType = 'subchapter' | 'video' | 'pdf' | 'text';

type CourseMeta = {
  id: string;
  title: string;
};

type ChapterMeta = {
  id: string;
  title: string;
};

type Attachment = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: number;
};

type LessonData = {
  id: string;
  title: string;
  type: LessonType;
  shortDescription: string;
  content: string;
  status: LessonStatus;
  parentLessonId: string | null;
  pdfUrl?: string;
  videoUrl?: string;
  attachments?: Attachment[];
};

type LessonFormState = {
  title: string;
  shortDescription: string;
  content: string;
  status: LessonStatus;
};

const emptyLessonForm: LessonFormState = {
  title: '',
  shortDescription: '',
  content: '',
  status: 'published',
};

const LessonEditor = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const statusStyles = useMemo(() => getStatusStyles(primaryColor), [primaryColor]);
  const { courseId, chapterId, lessonId } = useParams<{ courseId: string; chapterId: string; lessonId: string }>();
  const { registerNavigationGuard, unregisterNavigationGuard } = useNavigation();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [chapter, setChapter] = useState<ChapterMeta | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [courseLoading, setCourseLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveSuccessOpen, setSaveSuccessOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadMode, setVideoUploadMode] = useState<'upload' | 'record'>('upload');
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [blockedNavigation, setBlockedNavigation] = useState<(() => void) | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const [warningEnabled, setWarningEnabled] = useState(true);

  // Sync ref with state
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Lade Einstellungen
  useEffect(() => {
    const saved = localStorage.getItem('showUnsavedWarning');
    if (saved !== null) {
      setWarningEnabled(saved === 'true');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Warnung beim Verlassen der Seite
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && warningEnabled) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, warningEnabled]);

  // Registriere Navigation Guard (nur einmal)
  const navigationGuard = useCallback(() => {
    if (hasUnsavedChangesRef.current && warningEnabled) {
      setShowUnsavedDialog(true);
      return false;
    }
    return true;
  }, [warningEnabled]);

  useEffect(() => {
    registerNavigationGuard(navigationGuard);
    return () => unregisterNavigationGuard();
  }, [navigationGuard, registerNavigationGuard, unregisterNavigationGuard]);

  const courseRef = useMemo(() => {
    if (!currentUser || !courseId) {
      return null;
    }
    return doc(db, 'users', currentUser.uid, 'courses', courseId);
  }, [currentUser, courseId]);

  const chaptersCollection = useMemo(() => {
    if (!courseRef) {
      return null;
    }
    return collection(courseRef, 'chapters');
  }, [courseRef]);

  const chapterRef = useMemo(() => {
    if (!chaptersCollection || !chapterId) {
      return null;
    }
    return doc(chaptersCollection, chapterId);
  }, [chaptersCollection, chapterId]);

  const lessonsCollection = useMemo(() => {
    if (!chapterRef) {
      return null;
    }
    return collection(chapterRef, 'lessons');
  }, [chapterRef]);

  const lessonRef = useMemo(() => {
    if (!lessonsCollection || !lessonId) {
      return null;
    }
    return doc(lessonsCollection, lessonId);
  }, [lessonsCollection, lessonId]);

  useEffect(() => {
    if (!courseRef) {
      setCourse(null);
      setCourseLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      courseRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCourse(null);
        } else {
          const data = snapshot.data();
          setCourse({ id: snapshot.id, title: data.title ?? 'Unbenannter Kurs' });
        }
        setCourseLoading(false);
      },
      () => {
        setCourse(null);
        setCourseLoading(false);
      },
    );
    return unsubscribe;
  }, [courseRef]);

  useEffect(() => {
    if (!chapterRef) {
      setChapter(null);
      setChapterLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      chapterRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setChapter(null);
        } else {
          const data = snapshot.data();
          setChapter({ id: snapshot.id, title: data.title ?? 'Kapitel' });
        }
        setChapterLoading(false);
      },
      () => {
        setChapter(null);
        setChapterLoading(false);
      },
    );
    return unsubscribe;
  }, [chapterRef]);

  useEffect(() => {
    if (!lessonRef) {
      setLesson(null);
      setLessonLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      lessonRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setLesson(null);
        } else {
          const data = snapshot.data();
          const loadedLesson: LessonData = {
            id: snapshot.id,
            title: data.title ?? 'Neue Lektion',
            type: (data.type as LessonType) ?? 'text',
            shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
            content: typeof data.content === 'string' ? data.content : '',
            status: (data.status as LessonStatus) ?? 'draft',
            parentLessonId: typeof data.parentLessonId === 'string' ? data.parentLessonId : null,
            pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : undefined,
            videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : undefined,
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
          };
          setLesson(loadedLesson);
          setPdfUrl(loadedLesson.pdfUrl ?? null);
          setVideoUrl(loadedLesson.videoUrl ?? null);
          setAttachments(loadedLesson.attachments ?? []);
          setLessonForm({
            title: loadedLesson.title,
            shortDescription: loadedLesson.shortDescription,
            content: loadedLesson.content,
            status: loadedLesson.status,
          });
        }
        setLessonLoading(false);
      },
      () => {
        setLesson(null);
        setLessonLoading(false);
      },
    );
    return unsubscribe;
  }, [lessonRef]);

  const handleLessonInputChange = (field: keyof LessonFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setLessonForm((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);
    };

  const handleLessonStatusSelect = (status: LessonStatus) => {
    setLessonForm((prev) => ({ ...prev, status }));
    setHasUnsavedChanges(true);
  };

  const handlePdfFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const maxSizeInMB = 50;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    if (file.type !== 'application/pdf') {
      setPageError('Bitte nur PDF-Dateien hochladen.');
      return;
    }
    
    if (file.size > maxSizeInBytes) {
      setPageError(`Die PDF-Datei ist zu groß. Maximale Größe: ${maxSizeInMB} MB`);
      return;
    }
    
    setPageError(null);
    setPdfFile(file);
  };

  const handleUploadPdf = async () => {
    if (!pdfFile || !currentUser || !courseId || !chapterId || !lessonId) {
      return;
    }
    setUploadingPdf(true);
    setPageError(null);
    try {
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/lesson.pdf`);
      await uploadBytes(storageRef, pdfFile);
      const downloadUrl = await getDownloadURL(storageRef);
      setPdfUrl(downloadUrl);
      setPdfFile(null);
      setHasUnsavedChanges(true);
      setPageError(null);
    } catch (error) {
      console.error('PDF upload failed:', error);
      setPageError('PDF konnte nicht hochgeladen werden.');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleRemovePdf = async () => {
    if (!currentUser || !courseId || !chapterId || !lessonId || !pdfUrl) {
      return;
    }
    if (!window.confirm('PDF wirklich entfernen?')) {
      return;
    }
    setActionLoading(true);
    try {
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/lesson.pdf`);
      await deleteObject(storageRef).catch(() => {});
      setPdfUrl(null);
      if (lessonRef) {
        await updateDoc(lessonRef, { pdfUrl: null });
      }
    } catch (error) {
      console.error('PDF removal failed:', error);
      setPageError('PDF konnte nicht entfernt werden.');
    } finally {
      setActionLoading(false);
    }
  };

  // Attachment Handlers
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <PictureAsPdfIcon sx={{ color: '#e53935' }} />;
    if (fileType.includes('word') || fileType.includes('document')) return <DescriptionIcon sx={{ color: '#1976d2' }} />;
    if (fileType.includes('sheet') || fileType.includes('excel')) return <TableChartIcon sx={{ color: '#2e7d32' }} />;
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return <SlideshowIcon sx={{ color: '#ed6c02' }} />;
    if (fileType.includes('image')) return <ImageIcon sx={{ color: '#9c27b0' }} />;
    return <InsertDriveFileIcon sx={{ color: 'text.secondary' }} />;
  };

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser || !courseId || !chapterId || !lessonId) return;

    const maxSizeInMB = 100;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    if (file.size > maxSizeInBytes) {
      setPageError(`Die Datei ist zu groß. Maximale Größe: ${maxSizeInMB} MB`);
      return;
    }

    // Prüfe auf maximale Anzahl von Anhängen
    if (attachments.length >= 10) {
      setPageError('Maximale Anzahl von 10 Anhängen erreicht.');
      return;
    }

    setUploadingAttachment(true);
    setPageError(null);

    try {
      const attachmentId = crypto.randomUUID();
      const fileExtension = getFileExtension(file.name);
      const storagePath = `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/attachments/${attachmentId}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const newAttachment: Attachment = {
        id: attachmentId,
        name: file.name,
        url: downloadUrl,
        type: file.type,
        size: file.size,
        uploadedAt: Date.now(),
      };

      const updatedAttachments = [...attachments, newAttachment];
      setAttachments(updatedAttachments);

      // Speichere in Firestore
      if (lessonRef) {
        await updateDoc(lessonRef, { attachments: updatedAttachments });
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Attachment upload failed:', error);
      setPageError('Datei konnte nicht hochgeladen werden.');
    } finally {
      setUploadingAttachment(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!currentUser || !courseId || !lessonId) return;

    const attachment = attachments.find((a) => a.id === attachmentId);
    if (!attachment) return;

    if (!window.confirm(`"${attachment.name}" wirklich entfernen?`)) return;

    setActionLoading(true);
    try {
      // Lösche aus Storage
      const fileExtension = getFileExtension(attachment.name);
      const storagePath = `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/attachments/${attachmentId}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef).catch(() => {});

      // Aktualisiere State und Firestore
      const updatedAttachments = attachments.filter((a) => a.id !== attachmentId);
      setAttachments(updatedAttachments);

      if (lessonRef) {
        await updateDoc(lessonRef, { attachments: updatedAttachments });
      }
    } catch (error) {
      console.error('Attachment removal failed:', error);
      setPageError('Datei konnte nicht entfernt werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const maxSizeInMB = 1000;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    if (!file.type.startsWith('video/')) {
      setPageError('Bitte nur Video-Dateien hochladen.');
      return;
    }
    
    if (file.size > maxSizeInBytes) {
      setPageError(`Die Video-Datei ist zu groß. Maximale Größe: ${maxSizeInMB} MB`);
      return;
    }
    
    setPageError(null);
    setVideoFile(file);
  };

  const handleUploadVideo = async () => {
    if (!videoFile || !currentUser || !courseId || !chapterId || !lessonId) {
      return;
    }
    setUploadingVideo(true);
    setPageError(null);
    try {
      const fileExtension = videoFile.name.split('.').pop();
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/lesson.${fileExtension}`);
      await uploadBytes(storageRef, videoFile);
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Berechne die Videodauer
      const videoDuration = await new Promise<number>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(Math.round(video.duration));
        };
        video.onerror = () => {
          resolve(0);
        };
        video.src = URL.createObjectURL(videoFile);
      });
      
      setVideoUrl(downloadUrl);
      setVideoFile(null);
      
      // Speichere Video-URL und Dauer in Firestore
      if (lessonRef) {
        const updateData: Record<string, unknown> = { videoUrl: downloadUrl };
        if (videoDuration > 0) {
          updateData.videoDuration = videoDuration;
        }
        await updateDoc(lessonRef, updateData);
      }
      
      // Aktualisiere Kursdauer
      await updateCourseDuration();
      
      setPageError(null);
    } catch (error) {
      console.error('Video upload failed:', error);
      setPageError('Video konnte nicht hochgeladen werden.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const updateCourseDuration = async () => {
    if (!currentUser || !courseId) return;
    
    try {
      console.log('updateCourseDuration: Starting calculation for course', courseId);
      // Berechne Gesamtdauer aller Videos im Kurs
      let totalSeconds = 0;
      const chaptersSnapshot = await getDocs(
        collection(db, 'users', currentUser.uid, 'courses', courseId, 'chapters')
      );
      
      console.log('updateCourseDuration: Found', chaptersSnapshot.docs.length, 'chapters');
      
      for (const chapterDoc of chaptersSnapshot.docs) {
        const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
        console.log('updateCourseDuration: Chapter', chapterDoc.id, 'has', lessonsSnapshot.docs.length, 'lessons');
        
        for (const lessonDoc of lessonsSnapshot.docs) {
          const lessonData = lessonDoc.data();
          console.log('updateCourseDuration: Lesson', lessonDoc.id, 'videoDuration:', lessonData.videoDuration);
          
          if (lessonData.videoDuration && typeof lessonData.videoDuration === 'number' && isFinite(lessonData.videoDuration)) {
            totalSeconds += lessonData.videoDuration;
            console.log('updateCourseDuration: Added', lessonData.videoDuration, 'seconds. Total now:', totalSeconds);
          }
        }
      }
      
      console.log('updateCourseDuration: Total duration in seconds:', totalSeconds);
      
      // Formatiere Dauer
      let formattedDuration = '0:00';
      if (isFinite(totalSeconds) && totalSeconds > 0) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        if (hours > 0) {
          formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
          formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
      
      console.log('updateCourseDuration: Formatted duration:', formattedDuration);
      
      // Aktualisiere Kurs
      await setDoc(
        doc(db, 'users', currentUser.uid, 'courses', courseId),
        { duration: formattedDuration },
        { merge: true }
      );
      
      console.log('updateCourseDuration: Course document updated successfully');
    } catch (error) {
      console.error('Could not update course duration:', error);
    }
  };

  const handleRemoveVideo = async () => {
    if (!currentUser || !courseId || !chapterId || !lessonId || !videoUrl) {
      return;
    }
    if (!window.confirm('Video wirklich entfernen?')) {
      return;
    }
    setActionLoading(true);
    try {
      // Extract file extension from URL
      const urlParts = videoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/${fileName}`);
      await deleteObject(storageRef).catch(() => {});
      setVideoUrl(null);
      if (lessonRef) {
        await updateDoc(lessonRef, { videoUrl: null, videoDuration: null });
      }
      // Aktualisiere Kursdauer
      await updateCourseDuration();
    } catch (error) {
      console.error('Video removal failed:', error);
      setPageError('Video konnte nicht entfernt werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordedVideo = async (videoBlob: Blob, duration: number) => {
    if (!currentUser || !courseId || !chapterId || !lessonId) {
      console.log('handleRecordedVideo aborted: missing params');
      return;
    }
    
    console.log('handleRecordedVideo called with duration:', duration);
    
    setUploadingVideo(true);
    setShowVideoRecorder(false);
    setPageError(null);
    
    try {
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/lesson.webm`);
      await uploadBytes(storageRef, videoBlob);
      const downloadUrl = await getDownloadURL(storageRef);
      setVideoUrl(downloadUrl);
      
      const roundedDuration = Math.round(duration);
      console.log('Saving videoDuration to Firestore:', roundedDuration);
      
      // Speichere die Videodauer in Firestore
      if (lessonRef) {
        await updateDoc(lessonRef, { 
          videoUrl: downloadUrl,
          videoDuration: roundedDuration
        });
        console.log('videoDuration saved successfully');
      }
      
      // Aktualisiere Kursdauer
      console.log('Calling updateCourseDuration...');
      await updateCourseDuration();
      console.log('updateCourseDuration completed');
      
      setPageError(null);
    } catch (error) {
      console.error('Video upload failed:', error);
      setPageError('Video konnte nicht hochgeladen werden.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleEditedVideo = async (videoBlob: Blob, duration: number) => {
    if (!currentUser || !courseId || !chapterId || !lessonId) {
      return;
    }
    
    setUploadingVideo(true);
    setShowVideoEditor(false);
    setPageError(null);
    
    try {
      const storageRef = ref(storage, `users/${currentUser.uid}/courses/${courseId}/lessons/${lessonId}/lesson.webm`);
      await uploadBytes(storageRef, videoBlob);
      const downloadUrl = await getDownloadURL(storageRef);
      setVideoUrl(downloadUrl);
      
      const roundedDuration = Math.round(duration);
      
      if (lessonRef) {
        await updateDoc(lessonRef, { 
          videoUrl: downloadUrl,
          videoDuration: roundedDuration
        });
      }
      
      await updateCourseDuration();
      setPageError(null);
    } catch (error) {
      console.error('Video update failed:', error);
      setPageError('Video konnte nicht aktualisiert werden.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!lessonRef) {
      return;
    }
    if (!lessonForm.title.trim()) {
      setPageError('Bitte einen Lektionstitel angeben.');
      return;
    }
    setPageError(null);
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        title: lessonForm.title.trim(),
        shortDescription: lessonForm.shortDescription.trim(),
        status: lessonForm.status,
        updatedAt: serverTimestamp(),
      };
      
      if (lesson?.type === 'text') {
        updateData.content = lessonForm.content.trim();
      } else if (lesson?.type === 'pdf') {
        updateData.content = lessonForm.content.trim();
        if (pdfUrl) {
          updateData.pdfUrl = pdfUrl;
        }
      } else if (lesson?.type === 'video') {
        updateData.content = lessonForm.content.trim();
        if (videoUrl) {
          updateData.videoUrl = videoUrl;
        }
      }
      
      await updateDoc(lessonRef, updateData);
      setHasUnsavedChanges(false);
      setSaveSuccessOpen(true);
    } catch (error) {
      setPageError('Lektion konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonRef || !courseRef || !lesson) {
      return;
    }
    if (!window.confirm('Lektion wirklich löschen?')) {
      return;
    }
    setPageError(null);
    setActionLoading(true);
    try {
      await deleteDoc(lessonRef);
      if (lesson.type !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(-1) });
      }
      navigate(`/courses/${courseId}`);
    } catch (error) {
      setPageError('Lektion konnte nicht gelöscht werden.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackToCourse = () => {
    if (hasUnsavedChanges && warningEnabled) {
      setBlockedNavigation(() => () => navigate(courseId ? `/courses/${courseId}` : '/courses'));
      setShowUnsavedDialog(true);
    } else {
      navigate(courseId ? `/courses/${courseId}` : '/courses');
    }
  };

  const handleNavigateTo = (path: string) => {
    if (hasUnsavedChanges && warningEnabled) {
      setBlockedNavigation(() => () => navigate(path));
      setShowUnsavedDialog(true);
    } else {
      navigate(path);
    }
  };

  const handleConfirmNavigation = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    if (blockedNavigation) {
      blockedNavigation();
      setBlockedNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedDialog(false);
    setBlockedNavigation(null);
  };

  const isTextLesson = lesson?.type === 'text';
  const isPdfLesson = lesson?.type === 'pdf';
  const isVideoLesson = lesson?.type === 'video';
  const isEditableLesson = isTextLesson || isPdfLesson || isVideoLesson;

  const renderStatusButtons = () => (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {Object.entries(statusStyles).map(([value, config]) => {
        const isActive = lessonForm.status === value;
        return (
          <Button
            key={value}
            size="small"
            variant={isActive ? 'contained' : 'outlined'}
            onClick={() => handleLessonStatusSelect(value as LessonStatus)}
            sx={{
              textTransform: 'none',
              borderColor: isActive ? primaryColor : undefined,
              bgcolor: isActive ? primaryColor : undefined,
              color: isActive ? '#fff' : undefined,
              boxShadow: 'none',
              '&:hover': isActive
                ? {
                    borderColor: primaryColor,
                    bgcolor: primaryColor,
                  }
                : undefined,
            }}
          >
            {config.label}
          </Button>
        );
      })}
    </Stack>
  );

  if (!courseId || !chapterId || !lessonId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">Diese Lektion konnte nicht geladen werden.</Alert>
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert 
          severity="info"
          sx={{
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: (theme) => {
              const lum = getLuminance(theme.palette.primary.main);
              if (theme.palette.mode === 'dark') {
                return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              } else {
                return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              }
            },
            '& .MuiAlert-icon': {
              color: (theme) => {
                const lum = getLuminance(theme.palette.primary.main);
                if (theme.palette.mode === 'dark') {
                  return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                } else {
                  return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                }
              },
            },
          }}
        >
          Bitte melde dich an, um Lektionen zu bearbeiten.
        </Alert>
      </Box>
    );
  }

  const showLoader = courseLoading || chapterLoading || lessonLoading;

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 1160,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link 
          component="button"
          onClick={(e) => {
            e.preventDefault();
            handleNavigateTo('/courses');
          }}
          underline="hover" 
          color="inherit"
          sx={{ cursor: 'pointer' }}
        >
          Kurse
        </Link>
        {courseId ? (
          <Link 
            component="button"
            onClick={(e) => {
              e.preventDefault();
              handleNavigateTo(`/courses/${courseId}`);
            }}
            underline="hover" 
            color="inherit"
            sx={{ cursor: 'pointer' }}
          >
            {course?.title ?? 'Kurs'}
          </Link>
        ) : null}
        <Typography color="text.primary">{lessonForm.title || 'Lektion'}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {lessonForm.title || 'Text-Lektion'}
          </Typography>
          <Typography color="text.secondary">
            {chapter?.title ? `${chapter.title} · ${course?.title ?? ''}` : course?.title ?? ''}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToCourse}
          sx={{ textTransform: 'none' }}
        >
          Zurück zum Kurs
        </Button>
      </Stack>

      {pageError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pageError}
        </Alert>
      ) : null}

      {showLoader ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : !lesson ? (
        <Alert severity="warning">
          Diese Lektion wurde nicht gefunden oder wurde gelöscht.
        </Alert>
      ) : !isEditableLesson ? (
        <Alert 
          severity="info"
          sx={{
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: (theme) => {
              const lum = getLuminance(theme.palette.primary.main);
              if (theme.palette.mode === 'dark') {
                return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              } else {
                return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
              }
            },
            '& .MuiAlert-icon': {
              color: (theme) => {
                const lum = getLuminance(theme.palette.primary.main);
                if (theme.palette.mode === 'dark') {
                  return lum < 0.3 ? lighten(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                } else {
                  return lum > 0.7 ? darken(theme.palette.primary.main, 0.5) : theme.palette.primary.main;
                }
              },
            },
          }}
        >
          Dieser Lektionstyp wird aktuell nicht unterstützt.
        </Alert>
      ) : (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Status
            </Typography>
            {renderStatusButtons()}
          </Box>
          <TextField
            label="Name der Lektion"
            value={lessonForm.title}
            onChange={handleLessonInputChange('title')}
            fullWidth
          />
          <TextField
            label="Kurzbeschreibung"
            value={lessonForm.shortDescription}
            onChange={handleLessonInputChange('shortDescription')}
            multiline
            minRows={2}
            fullWidth
          />
          {isPdfLesson && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                PDF-Datei
              </Typography>
              {pdfUrl ? (
                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: 2,
                      border: '2px dashed',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      bgcolor: 'rgba(26, 101, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 48, color: 'error.main' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600}>PDF hochgeladen</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Die PDF-Datei wurde erfolgreich gespeichert.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleRemovePdf}
                      disabled={actionLoading}
                    >
                      Entfernen
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      width: '100%',
                      height: 600,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <iframe
                      src={pdfUrl}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="PDF Vorschau"
                    />
                  </Box>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: 3,
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                      bgcolor: 'background.default',
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Keine PDF hochgeladen
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Lade eine PDF-Datei hoch, die in dieser Lektion angezeigt werden soll.
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadFileIcon />}
                    >
                      PDF auswählen
                      <input
                        type="file"
                        hidden
                        accept="application/pdf"
                        onChange={handlePdfFileChange}
                      />
                    </Button>
                  </Box>
                  {pdfFile && (
                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <PictureAsPdfIcon sx={{ color: 'error.main' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {pdfFile.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleUploadPdf}
                        disabled={uploadingPdf}
                      >
                        {uploadingPdf ? 'Lädt hoch...' : 'Hochladen'}
                      </Button>
                      <IconButton size="small" onClick={() => setPdfFile(null)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          )}
          {isVideoLesson && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Video-Datei
              </Typography>
              {videoUrl ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Video hochgeladen
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ContentCutIcon />}
                      onClick={() => setShowVideoEditor(true)}
                      disabled={uploadingVideo}
                    >
                      Video bearbeiten
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleRemoveVideo}
                      disabled={actionLoading}
                    >
                      Entfernen
                    </Button>
                  </Stack>
                  <Box
                    sx={{
                      width: '100%',
                      height: 450,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'background.default',
                    }}
                  >
                    <video
                      src={videoUrl}
                      controls
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <ToggleButtonGroup
                    value={videoUploadMode}
                    exclusive
                    onChange={(_, newMode) => {
                      if (newMode) setVideoUploadMode(newMode);
                    }}
                    fullWidth
                  >
                    <ToggleButton value="upload">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <UploadFileIcon fontSize="small" />
                        <Typography>Hochladen</Typography>
                      </Stack>
                    </ToggleButton>
                    <ToggleButton value="record">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <VideocamIcon fontSize="small" />
                        <Typography>Aufnehmen</Typography>
                      </Stack>
                    </ToggleButton>
                  </ToggleButtonGroup>
                  
                  {videoUploadMode === 'upload' ? (
                    <>
                      <Box
                        sx={{
                          p: 3,
                          border: '2px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          textAlign: 'center',
                          bgcolor: 'background.default',
                        }}
                      >
                        <PlayCircleOutlineIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Kein Video hochgeladen
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Lade eine Video-Datei hoch, die in dieser Lektion angezeigt werden soll.
                        </Typography>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<UploadFileIcon />}
                        >
                          Video auswählen
                          <input
                            type="file"
                            hidden
                            accept="video/*"
                            onChange={handleVideoFileChange}
                          />
                        </Button>
                      </Box>
                      {videoFile && (
                        <Box
                          sx={{
                            p: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <PlayCircleOutlineIcon sx={{ color: 'primary.main' }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {videoFile.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            onClick={handleUploadVideo}
                            disabled={uploadingVideo}
                          >
                            {uploadingVideo ? <CircularProgress size={24} /> : 'Hochladen'}
                          </Button>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Box
                      sx={{
                        p: 3,
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        textAlign: 'center',
                        bgcolor: 'background.default',
                      }}
                    >
                      <VideocamIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Video aufnehmen
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Nimm ein Video mit deiner Webcam oder deinem Bildschirm auf. <br></br>
                        Maximale Dateigröße für Uploads: 1 GB.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<VideocamIcon />}
                        onClick={() => setShowVideoRecorder(true)}
                      >
                        Aufnahme starten
                      </Button>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          )}
          {isVideoLesson && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Zusätzliche Dateien (optional)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Füge ergänzende Materialien hinzu (PDF, Word, Excel, PowerPoint, Bilder etc.)
              </Typography>
              
              {/* Bestehende Anhänge */}
              {attachments.length > 0 && (
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  {attachments.map((attachment) => (
                    <Box
                      key={attachment.id}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 28 }}>
                        {getFileIcon(attachment.type)}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="body2" 
                          fontWeight={600}
                          sx={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {attachment.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(attachment.size)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Öffnen">
                          <IconButton
                            size="small"
                            onClick={() => window.open(attachment.url, '_blank')}
                            sx={{ color: 'primary.main' }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Herunterladen">
                          <IconButton
                            size="small"
                            component="a"
                            href={attachment.url}
                            download={attachment.name}
                            target="_blank"
                            sx={{ color: 'primary.main' }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Entfernen">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveAttachment(attachment.id)}
                            disabled={actionLoading}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
              
              {/* Upload-Bereich */}
              <Box
                sx={{
                  p: 2.5,
                  border: '2px dashed',
                  borderColor: uploadingAttachment ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  textAlign: 'center',
                  bgcolor: uploadingAttachment ? (theme) => alpha(theme.palette.primary.main, 0.04) : 'background.default',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  },
                }}
              >
                {uploadingAttachment ? (
                  <Stack alignItems="center" spacing={1}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary">
                      Datei wird hochgeladen...
                    </Typography>
                  </Stack>
                ) : (
                  <>
                    <AttachFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {attachments.length === 0 
                        ? 'Noch keine Dateien angehängt'
                        : `${attachments.length} von 10 Dateien`}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<AttachFileIcon />}
                      disabled={attachments.length >= 10}
                      size="small"
                    >
                      Datei anhängen
                      <input
                        type="file"
                        hidden
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip,.rar"
                        onChange={handleAttachmentUpload}
                      />
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      Max. 100 MB pro Datei
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          )}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {isPdfLesson ? 'Zusätzlicher Text (optional)' : isVideoLesson ? 'Zusätzlicher Text (optional)' : 'Textinhalt'}
            </Typography>
            {isTextLesson || isPdfLesson || isVideoLesson ? (
              <RichTextEditor
                content={lessonForm.content}
                onChange={(newContent) => {
                  setLessonForm((prev) => ({ ...prev, content: newContent }));
                  setHasUnsavedChanges(true);
                }}
                placeholder={isPdfLesson || isVideoLesson ? 'Optionaler Text, der unter dem Inhalt angezeigt wird ...' : 'Schreibe hier den ausführlichen Lektionstext ...'}
                minHeight={isPdfLesson || isVideoLesson ? 200 : 400}
              />
            ) : (
              <TextField
                placeholder="Schreibe hier den ausführlichen Lektionstext ..."
                value={lessonForm.content}
                onChange={handleLessonInputChange('content')}
                multiline
                minRows={12}
                fullWidth
              />
            )}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleDeleteLesson}
              disabled={actionLoading}
              sx={{ textTransform: 'none' }}
            >
              Löschen
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveLesson}
              disabled={saving || !lessonForm.title.trim() || !isEditableLesson}
              sx={{ textTransform: 'none', minWidth: 160 }}
            >
              {saving ? 'Speichert...' : 'Änderungen speichern'}
            </Button>
          </Stack>
        </Stack>
      )}

      <Dialog
        open={showUnsavedDialog}
        onClose={handleCancelNavigation}
        aria-labelledby="unsaved-dialog-title"
        aria-describedby="unsaved-dialog-description"
      >
        <DialogTitle id="unsaved-dialog-title">
          Nicht gespeicherte Änderungen
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="unsaved-dialog-description">
            Du hast nicht gespeicherte Änderungen. Möchtest du diese Seite wirklich verlassen? Alle nicht gespeicherten Änderungen gehen verloren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelNavigation} color="primary">
            Abbrechen
          </Button>
          <Button onClick={handleConfirmNavigation} color="error" variant="contained" autoFocus>
            Trotzdem verlassen
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={saveSuccessOpen}
        autoHideDuration={3000}
        onClose={() => setSaveSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSaveSuccessOpen(false)}
          severity="success"
          variant="filled"
          icon={<CheckCircleIcon />}
          sx={{ width: '100%' }}
        >
          Änderungen erfolgreich gespeichert
        </Alert>
      </Snackbar>

      {/* Video Recorder Dialog */}
      {showVideoRecorder && (
        <VideoRecorder
          onSave={handleRecordedVideo}
          onCancel={() => setShowVideoRecorder(false)}
        />
      )}

      {/* Video Editor Dialog */}
      {showVideoEditor && videoUrl && (
        <VideoEditor
          videoUrl={videoUrl}
          onSave={handleEditedVideo}
          onCancel={() => setShowVideoEditor(false)}
        />
      )}
    </Box>
  );
};

export default LessonEditor;
