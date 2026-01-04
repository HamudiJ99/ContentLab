import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AddIcon from '@mui/icons-material/Add';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UploadIcon from '@mui/icons-material/Upload';
import CollectionsIcon from '@mui/icons-material/Collections';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../firebase/firebaseConfig';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

const statusStyles = {
  published: { label: 'Veröffentlicht', dot: '#22c55e', color: '#22c55e' },
  draft: { label: 'Entwurf', dot: '#fbbf24', color: '#fbbf24' },
  disabled: { label: 'Deaktiviert', dot: '#a1a1aa', color: '#a1a1aa' },
} as const;

type ChapterStatus = keyof typeof statusStyles;

type Category = {
  id: string;
  name: string;
  showInFilters?: boolean;
};

type CourseData = {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  coverImageUrl?: string;
  coverColor?: string;
};

type Chapter = {
  id: string;
  title: string;
  description: string;
  status: ChapterStatus;
  coverColor?: string;
  position: number;
};

type LessonType = 'subchapter' | 'video' | 'pdf' | 'text';

type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  parentLessonId?: string | null;
  position: number;
};

type CourseFormState = {
  title: string;
  description: string;
  coverImageUrl: string;
  categoryIds: string[];
  coverColor: string;
};

const emptyCourseForm: CourseFormState = {
  title: '',
  description: '',
  coverImageUrl: '',
  categoryIds: [],
  coverColor: '',
};

type ChapterFormState = {
  title: string;
  description: string;
  status: ChapterStatus;
  coverColor: string;
};

const emptyChapterForm: ChapterFormState = {
  title: '',
  description: '',
  status: 'draft',
  coverColor: '',
};

type LessonFormState = {
  title: string;
  type: LessonType;
  parentLessonId: string | null;
};

const emptyLessonForm: LessonFormState = {
  title: '',
  type: 'video',
  parentLessonId: null,
};
type CropPreset = 'free' | '3:2' | '16:9' | 'square';

const cropAspectPresets: Array<{ label: string; value: CropPreset; aspect?: number }> = [
  { label: 'Frei', value: 'free' },
  { label: '3:2', value: '3:2', aspect: 3 / 2 },
  { label: '16:9', value: '16:9', aspect: 16 / 9 },
  { label: 'Quadrat', value: 'square', aspect: 1 },
];

const coverColorOptions: Array<{ label: string; value: string; swatch?: string }> = [
  { label: 'Standardfarbe', value: '', swatch: '#1a65ff' },
  { label: 'Rot', value: '#ef4444' },
  { label: 'Magenta', value: '#ec4899' },
  { label: 'Mandarine', value: '#f97316' },
  { label: 'Grün', value: '#22c55e' },
  { label: 'Aqua', value: '#14b8a6' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Honig', value: '#facc15' },
  { label: 'Graphit', value: '#0f172a' },
  { label: 'Schiefer', value: '#64748b' },
];

const lessonTypeOptions: Array<{ value: LessonType; label: string; icon: ReactNode }> = [
  { value: 'subchapter', label: 'Unterkapitel', icon: <FolderOpenOutlinedIcon /> },
  { value: 'video', label: 'Video/Audio', icon: <PlayCircleOutlineIcon /> },
  { value: 'pdf', label: 'PDF', icon: <PictureAsPdfOutlinedIcon /> },
  { value: 'text', label: 'Text', icon: <ArticleOutlinedIcon /> },
];

const lessonTypeConfig: Record<LessonType, { label: string; icon: ReactNode; color: string }> = {
  subchapter: { label: 'Unterkapitel', icon: <FolderOpenOutlinedIcon fontSize="small" />, color: '#2563eb' },
  video: { label: 'Video/Audio', icon: <PlayCircleOutlineIcon fontSize="small" />, color: '#0ea5e9' },
  pdf: { label: 'PDF', icon: <PictureAsPdfOutlinedIcon fontSize="small" />, color: '#ef4444' },
  text: { label: 'Text', icon: <ArticleOutlinedIcon fontSize="small" />, color: '#a855f7' },
};

const CourseEditor = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const categoryLabelId = 'course-editor-category-label';
  const categorySelectId = 'course-editor-category-select';
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, Lesson[]>>({});
  const [courseLoading, setCourseLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseCoverFile, setCourseCoverFile] = useState<File | null>(null);
  const courseCoverInputRef = useRef<HTMLInputElement>(null);
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterDialogMode, setChapterDialogMode] = useState<'create' | 'edit'>('create');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [chapterForm, setChapterForm] = useState<ChapterFormState>(emptyChapterForm);
  const [chapterSaving, setChapterSaving] = useState(false);
  const lessonListeners = useRef<Record<string, () => void>>({});
  const hasSyncedCountsRef = useRef(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [lessonTargetChapterId, setLessonTargetChapterId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [statusMenu, setStatusMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const ownerId = currentUser?.uid ?? 'shared';
  const [coverToolsOpen, setCoverToolsOpen] = useState(false);
  const [chapterAppearanceOpen, setChapterAppearanceOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingFileName, setPendingFileName] = useState('cover.jpg');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropPreset, setCropPreset] = useState<CropPreset>('square');
  const cropAspect = useMemo(() => {
    const preset = cropAspectPresets.find((option) => option.value === cropPreset);
    return preset?.aspect;
  }, [cropPreset]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(lessonListeners.current).forEach((unsubscribe) => unsubscribe());
      lessonListeners.current = {};
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setCategories([]);
      return undefined;
    }
    const categoriesQuery = query(collection(db, 'users', currentUser.uid, 'categories'), orderBy('position', 'asc'));
    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const orderedCategories = snapshot.docs
          .map((docSnapshot, index) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              name: data.name ?? 'Neue Kategorie',
              showInFilters: data.showInFilters !== false,
              position: typeof data.position === 'number' ? data.position : index,
            };
          })
          .sort((a, b) => a.position - b.position)
          .map(({ position, ...category }) => category as Category);
        setCategories(orderedCategories);
      },
      () => {
        setCategories([]);
      },
    );
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !courseId) {
      setCourse(null);
      setChapters([]);
      setCourseLoading(false);
      setChaptersLoading(false);
      return;
    }
    setCourseLoading(true);
    setChaptersLoading(true);
    const courseRef = doc(db, 'users', currentUser.uid, 'courses', courseId);
    const chaptersQuery = query(collection(courseRef, 'chapters'), orderBy('position', 'asc'));

    const unsubscribeCourse = onSnapshot(
      courseRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCourse(null);
        } else {
          const data = snapshot.data();
          setCourse({
            id: snapshot.id,
            title: data.title ?? 'Unbenannter Kurs',
            description: data.description ?? '',
            categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
            coverImageUrl:
              typeof data.coverImageUrl === 'string' && data.coverImageUrl.trim().length > 0
                ? data.coverImageUrl
                : undefined,
            coverColor:
              typeof data.coverColor === 'string' && data.coverColor.trim().length > 0
                ? data.coverColor
                : undefined,
          });
        }
        setCourseLoading(false);
      },
      () => {
        setPageError('Kurs konnte nicht geladen werden.');
        setCourseLoading(false);
      },
    );

    const unsubscribeChapters = onSnapshot(
      chaptersQuery,
      (snapshot) => {
        const loadedChapters: Chapter[] = snapshot.docs.map((docSnapshot, index) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            title: data.title ?? 'Neues Kapitel',
            description: data.description ?? '',
            status: (data.status as ChapterStatus) ?? 'draft',
            coverColor:
              typeof data.coverColor === 'string' && data.coverColor.trim().length > 0
                ? data.coverColor
                : undefined,
            position: typeof data.position === 'number' ? data.position : index,
          };
        });
        setChapters(loadedChapters.sort((a, b) => a.position - b.position));
        const activeChapterIds = new Set(loadedChapters.map((chapter) => chapter.id));
        setLessonsByChapter((prev) => {
          const next = { ...prev };
          let changed = false;
          Object.keys(next).forEach((chapterId) => {
            if (!activeChapterIds.has(chapterId)) {
              delete next[chapterId];
              changed = true;
            }
          });
          return changed ? next : prev;
        });
        Object.keys(lessonListeners.current).forEach((chapterId) => {
          if (!activeChapterIds.has(chapterId)) {
            lessonListeners.current[chapterId]?.();
            delete lessonListeners.current[chapterId];
          }
        });
        setChaptersLoading(false);
      },
      () => {
        setPageError('Kapitel konnten nicht geladen werden.');
        setChaptersLoading(false);
      },
    );

    return () => {
      unsubscribeCourse();
      unsubscribeChapters();
    };
  }, [currentUser, courseId]);

  useEffect(() => {
    Object.values(lessonListeners.current).forEach((unsubscribe) => unsubscribe());
    lessonListeners.current = {};
    setLessonsByChapter({});
    setExpandedChapters(new Set());
    hasSyncedCountsRef.current = false;
  }, [courseId]);

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

  const refreshCourseAggregates = useCallback(async () => {
    if (!chaptersCollection || !courseRef) {
      return;
    }
    try {
      const chaptersSnapshot = await getDocs(chaptersCollection);
      let lessonsTotal = 0;
      await Promise.all(
        chaptersSnapshot.docs.map(async (chapterDoc) => {
          const lessonsCollectionRef = collection(chapterDoc.ref, 'lessons');
          const lessonsSnapshot = await getDocs(lessonsCollectionRef);
          lessonsTotal += lessonsSnapshot.docs.reduce((count, lessonDoc) => {
            const data = lessonDoc.data();
            const type = (data.type as LessonType) ?? 'text';
            return type === 'subchapter' ? count : count + 1;
          }, 0);
        }),
      );
      await updateDoc(courseRef, {
        chapters: chaptersSnapshot.size,
        lessons: lessonsTotal,
      });
    } catch (error) {
      console.error('Kursstatistiken konnten nicht synchronisiert werden', error);
    }
  }, [chaptersCollection, courseRef]);

  useEffect(() => {
    if (!courseRef || !chaptersCollection || hasSyncedCountsRef.current) {
      return;
    }
    hasSyncedCountsRef.current = true;
    void refreshCourseAggregates();
  }, [chaptersCollection, courseRef, refreshCourseAggregates]);

  const ensureLessonsListener = useCallback(
    (chapterId: string) => {
      if (!chaptersCollection || lessonListeners.current[chapterId]) {
        return;
      }
      const chapterRef = doc(chaptersCollection, chapterId);
      const lessonsCollectionRef = collection(chapterRef, 'lessons');
      const lessonsQuery = query(lessonsCollectionRef, orderBy('position', 'asc'));
      const unsubscribe = onSnapshot(
        lessonsQuery,
        (snapshot) => {
          const lessons: Lesson[] = snapshot.docs.map((docSnapshot, index) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              title: data.title ?? 'Neue Lektion',
              type: (data.type as LessonType) ?? 'text',
              parentLessonId: typeof data.parentLessonId === 'string' ? data.parentLessonId : null,
              position: typeof data.position === 'number' ? data.position : index,
            };
          });
          setLessonsByChapter((prev) => ({
            ...prev,
            [chapterId]: lessons.sort((a, b) => a.position - b.position),
          }));
        },
        () => {
          setPageError('Lektionen konnten nicht geladen werden.');
        },
      );
      lessonListeners.current[chapterId] = unsubscribe;
    },
    [chaptersCollection],
  );

  const handleOpenPropertiesDialog = () => {
    if (!course) {
      return;
    }
    setCourseForm({
      title: course.title,
      description: course.description,
      coverImageUrl: course.coverImageUrl ?? '',
      categoryIds: course.categoryIds,
      coverColor: course.coverColor ?? '',
    });
    setCourseCoverFile(null);
    setPropertiesDialogOpen(true);
  };

  const handleCourseInputChange = (field: keyof CourseFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCourseForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCourseCategoriesChange = (event: SelectChangeEvent<typeof courseForm.categoryIds>) => {
    const {
      target: { value },
    } = event;
    setCourseForm((prev) => ({
      ...prev,
      categoryIds: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  const handleSelectCoverColor = (color: string) => {
    setCourseCoverFile(null);
    setCourseForm((prev) => ({
      ...prev,
      coverColor: color,
      coverImageUrl: '',
    }));
  };

  const handleClearCoverColor = () => {
    setCourseForm((prev) => ({ ...prev, coverColor: '' }));
  };

  const openCropDialogForFile = (file: File) => {
    setPendingImageFile(file);
    setPendingFileName(file.name || 'course-cover.jpg');
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropPreset('square');
      setCroppedAreaPixels(null);
      setCropDialogOpen(true);
    };
    reader.onerror = () => {
      setPageError('Bild konnte nicht geladen werden.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCourseCover = (file: File) => {
    setCourseCoverFile(file);
    setCourseForm((prev) => ({ ...prev, coverImageUrl: '' }));
  };

  const resetCropDialog = () => {
    setCropDialogOpen(false);
    setCropImageSrc(null);
    setPendingImageFile(null);
    setPendingFileName('cover.jpg');
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPreset('square');
  };

  const handleCloseCropDialog = () => {
    resetCropDialog();
  };

  const handleUseOriginalImage = () => {
    if (!pendingImageFile) {
      resetCropDialog();
      return;
    }
    handleApplyCourseCover(pendingImageFile);
    resetCropDialog();
  };

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels || !cropImageSrc) {
      return;
    }
    try {
      const mimeType = pendingImageFile?.type || 'image/jpeg';
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels, mimeType);
      const fileName = pendingFileName || 'cover.jpg';
      const croppedFile = new File([blob], fileName, { type: mimeType });
      handleApplyCourseCover(croppedFile);
      resetCropDialog();
    } catch (error) {
      setPageError('Bild konnte nicht zugeschnitten werden.');
    }
  };

  const handleCourseCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      openCropDialogForFile(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const uploadCoverImage = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSaveCourseProperties = async () => {
    if (!courseRef || !course) {
      return;
    }
    if (!courseForm.title.trim()) {
      setPageError('Bitte einen Kursnamen angeben.');
      return;
    }
    setPageError(null);
    setCourseSaving(true);
    try {
      let coverUrl = courseForm.coverImageUrl.trim();
      if (courseCoverFile) {
        coverUrl = await uploadCoverImage(courseCoverFile, `courseCovers/${ownerId}/${course.id}`);
      }
      await setDoc(
        courseRef,
        {
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          categoryIds: courseForm.categoryIds,
          coverImageUrl: coverUrl,
          coverColor: courseForm.coverColor.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setPropertiesDialogOpen(false);
    } catch (error) {
      setPageError('Eigenschaften konnten nicht gespeichert werden.');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleOpenChapterDialog = (mode: 'create' | 'edit', chapter?: Chapter) => {
    setChapterDialogMode(mode);
    if (mode === 'edit' && chapter) {
      setActiveChapterId(chapter.id);
      setChapterForm({
        title: chapter.title,
        description: chapter.description,
        status: chapter.status,
        coverColor: chapter.coverColor ?? '',
      });
    } else {
      setActiveChapterId(null);
      setChapterForm(emptyChapterForm);
    }
    setChapterDialogOpen(true);
  };

  const handleOpenLessonDialog = (chapterId: string, parentLessonId: string | null = null) => {
    ensureLessonsListener(chapterId);
    setLessonTargetChapterId(chapterId);
    setLessonForm({ title: '', type: 'video', parentLessonId });
    setLessonDialogOpen(true);
  };

  const handleCloseLessonDialog = () => {
    if (lessonSaving) {
      return;
    }
    setLessonDialogOpen(false);
    setLessonTargetChapterId(null);
    setLessonForm(emptyLessonForm);
  };

  const handleChapterInputChange = (field: keyof ChapterFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setChapterForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSelectChapterColor = (color: string) => {
    setChapterForm((prev) => ({ ...prev, coverColor: color }));
  };

  const handleClearChapterColor = () => {
    setChapterForm((prev) => ({ ...prev, coverColor: '' }));
  };

  const handleSelectLessonType = (type: LessonType) => {
    setLessonForm((prev) => ({ ...prev, type }));
  };

  const saveChapter = async () => {
    if (!chaptersCollection || !courseRef) {
      return;
    }
    if (!chapterForm.title.trim()) {
      setPageError('Bitte einen Kapitelnamen angeben.');
      return;
    }
    setPageError(null);
    setChapterSaving(true);
    try {
      if (chapterDialogMode === 'create') {
        const newChapterRef = doc(chaptersCollection);
        await setDoc(newChapterRef, {
          title: chapterForm.title.trim(),
          description: chapterForm.description.trim(),
          status: chapterForm.status,
          coverColor: chapterForm.coverColor.trim(),
          position: chapters.length,
          createdAt: serverTimestamp(),
        });
        await updateDoc(courseRef, { chapters: increment(1) });
        setExpandedChapters((prev) => new Set(prev).add(newChapterRef.id));
        ensureLessonsListener(newChapterRef.id);
      } else if (activeChapterId) {
        const chapterRef = doc(chaptersCollection, activeChapterId);
        await updateDoc(chapterRef, {
          title: chapterForm.title.trim(),
          description: chapterForm.description.trim(),
          status: chapterForm.status,
          coverColor: chapterForm.coverColor.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      setChapterDialogOpen(false);
    } catch (error) {
      setPageError('Kapitel konnte nicht gespeichert werden.');
    } finally {
      setChapterSaving(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!chaptersCollection || !lessonTargetChapterId || !courseRef) {
      return;
    }
    if (!lessonForm.title.trim()) {
      setPageError('Bitte einen Lektionstitel angeben.');
      return;
    }
    const lessonType = lessonForm.type;
    setPageError(null);
    setLessonSaving(true);
    try {
      const chapterRef = doc(chaptersCollection, lessonTargetChapterId);
      const lessonsCollectionRef = collection(chapterRef, 'lessons');
      const lessonRef = doc(lessonsCollectionRef);
      await setDoc(lessonRef, {
        title: lessonForm.title.trim(),
        type: lessonType,
        parentLessonId: lessonForm.parentLessonId ?? null,
        position: Date.now(),
        createdAt: serverTimestamp(),
      });
      if (lessonType !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(1) });
      }
      setLessonDialogOpen(false);
      setLessonForm(emptyLessonForm);
      setLessonTargetChapterId(null);
    } catch (error) {
      setPageError('Lektion konnte nicht gespeichert werden.');
    } finally {
      setLessonSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!chaptersCollection || !courseRef || !window.confirm('Kapitel wirklich löschen?')) {
      return;
    }
    try {
      const chapterRef = doc(chaptersCollection, chapterId);
      const lessonsSnapshot = await getDocs(collection(chapterRef, 'lessons'));
      const realLessonCount = lessonsSnapshot.docs.reduce((count, lessonDoc) => {
        const data = lessonDoc.data();
        const type = (data.type as LessonType) ?? 'text';
        return type === 'subchapter' ? count : count + 1;
      }, 0);
      const batch = writeBatch(db);
      lessonsSnapshot.docs.forEach((lessonDoc) => {
        batch.delete(lessonDoc.ref);
      });
      batch.delete(chapterRef);
      await batch.commit();
      const updates: Record<string, unknown> = {
        chapters: increment(-1),
      };
      if (realLessonCount > 0) {
        updates.lessons = increment(-realLessonCount);
      }
      await updateDoc(courseRef, updates);
      void refreshCourseAggregates();
    } catch (error) {
      setPageError('Kapitel konnte nicht gelöscht werden.');
    }
  };

  const handleDuplicateChapter = async (chapter: Chapter) => {
    if (!chaptersCollection || !courseRef) {
      return;
    }
    try {
      const newChapterRef = doc(chaptersCollection);
      await setDoc(newChapterRef, {
        title: `${chapter.title} Kopie`,
        description: chapter.description,
        status: chapter.status,
        coverColor: chapter.coverColor ?? '',
        position: chapters.length,
        createdAt: serverTimestamp(),
      });
      await updateDoc(courseRef, { chapters: increment(1) });
      setExpandedChapters((prev) => new Set(prev).add(newChapterRef.id));
      ensureLessonsListener(newChapterRef.id);
    } catch (error) {
      setPageError('Kapitel konnte nicht dupliziert werden.');
    }
  };

  const handleStatusMenuOpen = (chapterId: string, anchorEl: HTMLElement) => {
    setStatusMenu({ anchorEl, chapterId });
  };

  const handleActionsMenuOpen = (chapterId: string, anchorEl: HTMLElement) => {
    setActionsMenu({ anchorEl, chapterId });
  };

  const handleCloseMenus = () => {
    setStatusMenu({ anchorEl: null, chapterId: null });
    setActionsMenu({ anchorEl: null, chapterId: null });
  };

  const handleSelectStatus = async (nextStatus: ChapterStatus) => {
    if (!chaptersCollection || !statusMenu.chapterId) {
      handleCloseMenus();
      return;
    }
    try {
      await updateDoc(doc(chaptersCollection, statusMenu.chapterId), { status: nextStatus });
    } catch (error) {
      setPageError('Status konnte nicht aktualisiert werden.');
    } finally {
      handleCloseMenus();
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
        ensureLessonsListener(chapterId);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedChapters(new Set());
  };

  const renderLessonCard = (lesson: Lesson) => {
    const config = lessonTypeConfig[lesson.type] ?? lessonTypeConfig.text;
    return (
      <Paper
        key={lesson.id}
        variant="outlined"
        sx={{
          borderRadius: 2,
          p: 1.5,
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.default),
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            variant="rounded"
            sx={{ width: 48, height: 48, bgcolor: config.color, color: '#fff' }}
          >
            {config.icon}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={600}>{lesson.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {config.label}
            </Typography>
          </Box>
          <Chip label="Entwurf" size="small" sx={{ fontWeight: 600 }} />
        </Stack>
      </Paper>
    );
  };

  const renderChapterCard = (chapter: Chapter) => {
    const expanded = expandedChapters.has(chapter.id);
    const statusConfig = statusStyles[chapter.status];
    const avatarColor = chapter.coverColor || 'primary.main';
    const lessons = lessonsByChapter[chapter.id] ?? [];
    const standaloneLessons = lessons.filter((lesson) => lesson.type !== 'subchapter' && !lesson.parentLessonId);
    const subchapters = lessons.filter((lesson) => lesson.type === 'subchapter');
    const lessonsByParent = lessons.reduce<Record<string, Lesson[]>>((acc, lesson) => {
      if (lesson.parentLessonId) {
        if (!acc[lesson.parentLessonId]) {
          acc[lesson.parentLessonId] = [];
        }
        acc[lesson.parentLessonId].push(lesson);
      }
      return acc;
    }, {});
    return (
      <Paper
        key={chapter.id}
        variant="outlined"
        sx={{
          borderRadius: 3,
          p: 3,
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper),
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 56, height: 56, bgcolor: avatarColor, color: '#fff' }}>
            <FolderIcon />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              {chapter.title}
            </Typography>
            {chapter.description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {chapter.description}
              </Typography>
            ) : null}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={(event) => handleStatusMenuOpen(chapter.id, event.currentTarget)}
            startIcon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusConfig.dot }} />}
            sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {statusConfig.label}
          </Button>
          <IconButton onClick={() => toggleChapter(chapter.id)}>
            {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          <IconButton onClick={(event) => handleActionsMenuOpen(chapter.id, event.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Stack>
        {expanded && (
          <Box mt={3}>
            <Divider sx={{ mb: 3 }} />
            {standaloneLessons.length > 0 ? (
              <Stack spacing={1.5} mb={subchapters.length ? 3 : 2}>
                {standaloneLessons.map((lesson) => renderLessonCard(lesson))}
              </Stack>
            ) : null}
            {subchapters.map((subchapter) => {
              const children = lessonsByParent[subchapter.id] ?? [];
              return (
                <Box key={subchapter.id} mb={2.5}>
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      p: 2,
                      backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc'),
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ width: 44, height: 44, bgcolor: lessonTypeConfig.subchapter.color, color: '#fff' }}>
                          {lessonTypeConfig.subchapter.icon}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600}>{subchapter.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Unterkapitel
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        startIcon={<AddIcon />}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'none' }}
                        onClick={() => handleOpenLessonDialog(chapter.id, subchapter.id)}
                      >
                        Lektion hinzufügen
                      </Button>
                    </Stack>
                    <Stack spacing={1.25} mt={2}>
                      {children.length > 0 ? (
                        children.map((lesson) => renderLessonCard(lesson))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Noch keine Lektionen in diesem Unterkapitel.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              );
            })}
            {standaloneLessons.length === 0 && subchapters.length === 0 ? (
              <Typography variant="body2" color="text.secondary" mb={2}>
                Noch keine Lektionen hinzugefügt.
              </Typography>
            ) : null}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="body2" color="text.secondary">
                Füge neuen Inhalt hinzu, um dieses Kapitel weiter auszuarbeiten.
              </Typography>
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                sx={{ textTransform: 'none' }}
                onClick={() => handleOpenLessonDialog(chapter.id)}
              >
                Lektion hinzufügen
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    );
  };

  if (!courseId) {
    return null;
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">Bitte melde dich an, um Kurse zu bearbeiten.</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        pb: 6,
        maxWidth: 1160,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/courses" underline="hover" color="inherit">
          Kursübersicht
        </Link>
        <Typography color="text.primary">{course?.title ?? 'Kurs'}</Typography>
      </Breadcrumbs>

      {pageError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {pageError}
        </Alert>
      ) : null}

      {courseLoading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : course ? (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} mb={4}
            justifyContent="space-between">
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {course.title}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
                onClick={handleOpenPropertiesDialog}
                sx={{ textTransform: 'none' }}
              >
                Eigenschaften
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ textTransform: 'none' }}
                onClick={() => handleOpenChapterDialog('create')}
              >
                Kapitel
              </Button>
              <Tooltip title="Alle Kapitel einklappen">
                <IconButton onClick={collapseAll}>
                  <KeyboardArrowUpIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {chaptersLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={32} />
            </Stack>
          ) : chapters.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                p: 4,
                textAlign: 'center',
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper),
              }}
            >
              <Typography variant="h6" gutterBottom>
                Du hast noch keine Kapitel angelegt.
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Erstelle dein erstes Kapitel, um mit dem Kursaufbau zu beginnen.
              </Typography>
              <Button startIcon={<AddIcon />} onClick={() => handleOpenChapterDialog('create')} sx={{ textTransform: 'none' }}>
              Kapitel hinzufügen
            </Button>
              
            </Paper>
          ) : (
            <Stack spacing={2.5}>
              {chapters.map((chapter) => renderChapterCard(chapter))}
            </Stack>
          )}

         
        </>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Dieser Kurs wurde nicht gefunden.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/courses')}>
            Zur Kursübersicht
          </Button>
        </Paper>
      )}

      <Dialog open={propertiesDialogOpen} onClose={() => setPropertiesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kursspezifische Eigenschaften</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} mt={1}>
            <TextField label="Kursname" value={courseForm.title} onChange={handleCourseInputChange('title')} fullWidth />
            <TextField
              label="Kurzbeschreibung"
              value={courseForm.description}
              onChange={handleCourseInputChange('description')}
              fullWidth
              multiline
              minRows={3}
            />
            <FormControl fullWidth>
              <InputLabel id={categoryLabelId} shrink>
                Kategorien
              </InputLabel>
              <Select
                labelId={categoryLabelId}
                id={categorySelectId}
                multiple
                displayEmpty
                label="Kategorien"
                value={courseForm.categoryIds}
                onChange={handleCourseCategoriesChange}
                renderValue={(selected) => {
                  const selectedIds = selected as string[];
                  if (selectedIds.length === 0) {
                    return 'Keine Kategorie';
                  }
                  const labels = selectedIds
                    .map((id) => categories.find((category) => category.id === id)?.name)
                    .filter((label): label is string => Boolean(label));
                  if (labels.length === 0) {
                    return `${selectedIds.length} Kategorien`;
                  }
                  return labels.join(', ');
                }}
              >
                {categories.length === 0 ? (
                  <MenuItem disabled>Keine Kategorien verfügbar</MenuItem>
                ) : (
                  categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      <Checkbox
                        size="small"
                        checked={courseForm.categoryIds.includes(category.id)}
                        sx={{ mr: 1 }}
                      />
                      <Typography>{category.name}</Typography>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Cover & Darstellung
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bestimme, wie deine Karte in der Übersicht erscheint.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<KeyboardArrowDownIcon sx={{ transform: coverToolsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />}
                  onClick={() => setCoverToolsOpen((prev) => !prev)}
                  sx={{ textTransform: 'none' }}
                >
                  {coverToolsOpen ? 'Ausblenden' : 'Anzeigen'}
                </Button>
              </Stack>
              <Collapse in={coverToolsOpen} timeout="auto">
                <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box sx={{ flex: { md: '0 0 220px' } }}>
                      <Typography variant="subtitle2" gutterBottom color="text.secondary">
                        
                      </Typography>
                      <Box
                        sx={{
                          width: '100%',
                          height: 140,
                          borderRadius: 2.5,
                          position: 'relative',
                          overflow: 'hidden',
                          background: courseCoverFile || courseForm.coverImageUrl
                            ? 'action.hover'
                            : courseForm.coverColor || 'linear-gradient(135deg, #a855f7, #6366f1)',
                          border: courseForm.coverColor ? `1px solid ${courseForm.coverColor}` : `1px dashed`,
                          borderColor: courseForm.coverColor || (courseCoverFile || courseForm.coverImageUrl ? 'transparent' : 'divider'),
                        }}
                      >
                        {courseCoverFile ? (
                          <Box component="img" src={URL.createObjectURL(courseCoverFile)} alt="Cover Vorschau" sx={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'background.default' }} />
                        ) : courseForm.coverImageUrl ? (
                          <Box component="img" src={courseForm.coverImageUrl} alt="Cover Vorschau" sx={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'background.default' }} />
                        ) : (
                          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                            <CollectionsIcon sx={{ color: courseForm.coverColor ? 'rgba(255,255,255,0.9)' : 'text.disabled' }} />
                          </Stack>
                        )}
                      </Box>
                    </Box>

                    <Stack spacing={2} flex={1} width="100%">
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Bild oder Farbfläche
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Lade ein individuelles Cover hoch oder nutze eine kräftige Farbkachel für schnelle Entwürfe.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                          <input type="file" accept="image/*" hidden ref={courseCoverInputRef} onChange={handleCourseCoverChange} />
                          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => courseCoverInputRef.current?.click()} sx={{ textTransform: 'none' }}>
                            Vorschaubild auswählen
                          </Button>
                          {courseCoverFile || courseForm.coverImageUrl ? (
                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                setCourseCoverFile(null);
                                setCourseForm((prev) => ({ ...prev, coverImageUrl: '' }));
                              }}
                              sx={{ textTransform: 'none' }}
                            >
                              Bild entfernen
                            </Button>
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Tipp: Quadratische Bilder (z.&nbsp;B. 1024×1024&nbsp;px) füllen die Kurskarte ideal aus.
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Farbfläche wählen
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                            gap: 1.5,
                            justifyItems: 'center',
                            mb: 1,
                          }}
                        >
                          {coverColorOptions.map(({ label, value, swatch }) => {
                            const selected = courseForm.coverColor === value;
                            const swatchColor = (swatch ?? value) || '#1a65ff';
                            return (
                              <Tooltip key={value || label} title={label} placement="top" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleSelectCoverColor(value)}
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    bgcolor: swatchColor,
                                    border: selected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.4)',
                                    boxShadow: selected
                                      ? '0 0 0 2px rgba(26, 101, 255, 0.35)'
                                      : '0 4px 12px rgba(15, 23, 42, 0.15)',
                                    transition: 'transform 0.15s ease',
                                    '&:hover': {
                                      transform: 'translateY(-1px) scale(1.03)',
                                    },
                                  }}
                                />
                              </Tooltip>
                            );
                          })}
                        </Box>
                        <Button size="small" onClick={handleClearCoverColor} sx={{ textTransform: 'none' }}>
                          Keine Farbe
                        </Button>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
              </Collapse>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertiesDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSaveCourseProperties} variant="contained" disabled={courseSaving}>
            {courseSaving ? 'Speichert...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={chapterDialogOpen} onClose={() => setChapterDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{chapterDialogMode === 'create' ? 'Kapitel erstellen' : 'Kapitel bearbeiten'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} mt={1}>
            <TextField label="Kapitelname" value={chapterForm.title} onChange={handleChapterInputChange('title')} fullWidth />
            <TextField
              label="Kurzbeschreibung"
              value={chapterForm.description}
              onChange={handleChapterInputChange('description')}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={chapterForm.status}
                onChange={(event: SelectChangeEvent<ChapterStatus>) =>
                  setChapterForm((prev) => ({ ...prev, status: event.target.value as ChapterStatus }))
                }
              >
                {Object.entries(statusStyles).map(([value, config]) => (
                  <MenuItem key={value} value={value}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: config.dot }} />
                      <Typography>{config.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Kapitel-Icon & Farbe
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Steuere die Farbe des Ordners, um Kapitel leichter zu unterscheiden.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={
                    <KeyboardArrowDownIcon
                      sx={{
                        transform: chapterAppearanceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  }
                  onClick={() => setChapterAppearanceOpen((prev) => !prev)}
                  sx={{ textTransform: 'none' }}
                >
                  {chapterAppearanceOpen ? 'Ausblenden' : 'Anzeigen'}
                </Button>
              </Stack>
              <Collapse in={chapterAppearanceOpen} timeout="auto">
                <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Avatar
                      sx={{
                        width: 72,
                        height: 72,
                        bgcolor: chapterForm.coverColor || 'primary.main',
                        color: chapterForm.coverColor ? '#fff' : undefined,
                        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.2)',
                      }}
                    >
                      <FolderIcon />
                    </Avatar>
                    <Box flex={1} width="100%">
                      <Typography variant="subtitle2" gutterBottom>
                        Farbauswahl
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
                        Tippe eine Farbe an, die zur Kapitelstimmung passt.
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                          gap: 1.5,
                          justifyItems: 'center',
                          mb: 1,
                        }}
                      >
                        {coverColorOptions.map(({ label, value, swatch }) => {
                          const selected = chapterForm.coverColor === value;
                          const swatchColor = (swatch ?? value) || '#1a65ff';
                          return (
                            <Tooltip key={value || label} title={label} placement="top" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleSelectChapterColor(value)}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  bgcolor: swatchColor,
                                  border: selected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.4)',
                                  boxShadow: selected
                                    ? '0 0 0 2px rgba(26, 101, 255, 0.35)'
                                    : '0 4px 12px rgba(15, 23, 42, 0.15)',
                                  transition: 'transform 0.15s ease',
                                  '&:hover': {
                                    transform: 'translateY(-1px) scale(1.03)',
                                  },
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Die gewählte Farbe wird auf der Kapitelliste im Ordner-Icon angezeigt.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Collapse>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChapterDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={saveChapter} variant="contained" disabled={chapterSaving}>
            {chapterSaving ? 'Speichert...' : chapterDialogMode === 'create' ? 'Erstellen' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={lessonDialogOpen} onClose={handleCloseLessonDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Neue Lektion</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={1}>
            <TextField
              label="Name"
              value={lessonForm.title}
              onChange={(event) => setLessonForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
              autoFocus
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Typ
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5}>
                {(lessonForm.parentLessonId
                  ? lessonTypeOptions.filter((option) => option.value !== 'subchapter')
                  : lessonTypeOptions
                ).map((option) => {
                  const selected = lessonForm.type === option.value;
                  return (
                    <ButtonBase
                      key={option.value}
                      onClick={() => handleSelectLessonType(option.value)}
                      sx={{
                        borderRadius: 2.5,
                        border: selected ? '2px solid #4f46e5' : '1px solid rgba(148, 163, 184, 0.4)',
                        p: 2,
                        minWidth: 120,
                        bgcolor: selected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Stack spacing={1} alignItems="center" justifyContent="center">
                        <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(79,70,229,0.12)', color: '#4f46e5' }}>
                          {option.icon}
                        </Avatar>
                        <Typography fontWeight={600}>{option.label}</Typography>
                      </Stack>
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLessonDialog} disabled={lessonSaving}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSaveLesson}
            variant="contained"
            disabled={lessonSaving || !lessonForm.title.trim()}
          >
            {lessonSaving ? 'Speichert...' : 'Lektion hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cropDialogOpen} onClose={handleCloseCropDialog} maxWidth="md" fullWidth>
        <DialogTitle>Bild hochladen</DialogTitle>
        <DialogContent dividers>
          {cropImageSrc ? (
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: { xs: 260, sm: 360 },
                backgroundColor: 'common.black',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                onCropChange={setCrop}
                onZoomChange={(value) => setZoom(value)}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                restrictPosition={false}
              />
            </Box>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ height: 260 }}>
              <CircularProgress size={32} />
            </Stack>
          )}
          <Stack spacing={3} mt={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Seitenverhältnis
              </Typography>
              <RadioGroup
                row
                value={cropPreset}
                onChange={(event) => setCropPreset(event.target.value as CropPreset)}
              >
                {cropAspectPresets.map((preset) => (
                  <FormControlLabel key={preset.value} value={preset.value} control={<Radio />} label={preset.label} />
                ))}
              </RadioGroup>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Zoom
              </Typography>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(_, value) => setZoom(value as number)}
                aria-label="Zoom"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          {pendingImageFile ? (
            <Button onClick={handleUseOriginalImage}>Original verwenden</Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCloseCropDialog}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleConfirmCrop}
            disabled={!croppedAreaPixels || !cropImageSrc}
          >
            Zuschneiden
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={statusMenu.anchorEl}
        open={Boolean(statusMenu.anchorEl)}
        onClose={handleCloseMenus}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {Object.entries(statusStyles).map(([value, config]) => (
          <MenuItem key={value} onClick={() => handleSelectStatus(value as ChapterStatus)}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: config.dot }} />
              <Typography>{config.label}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={actionsMenu.anchorEl}
        open={Boolean(actionsMenu.anchorEl)}
        onClose={handleCloseMenus}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            const chapter = chapters.find((item) => item.id === actionsMenu.chapterId);
            if (chapter) {
              handleOpenChapterDialog('edit', chapter);
            }
            handleCloseMenus();
          }}
        >
          Bearbeiten
        </MenuItem>
        <MenuItem
          onClick={() => {
            const chapter = chapters.find((item) => item.id === actionsMenu.chapterId);
            if (chapter) {
              handleDuplicateChapter(chapter);
            }
            handleCloseMenus();
          }}
        >
          Duplizieren
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (actionsMenu.chapterId) {
              handleDeleteChapter(actionsMenu.chapterId);
            }
            handleCloseMenus();
          }}
        >
          Löschen
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default CourseEditor;

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedBlob(imageSrc: string, pixelCrop: Area, mimeType = 'image/jpeg'): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas konnte nicht initialisiert werden.');
  }
  const width = Math.round(pixelCrop.width);
  const height = Math.round(pixelCrop.height);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Bild konnte nicht gerendert werden.'));
      }
    }, mimeType, 0.92);
  });
}
