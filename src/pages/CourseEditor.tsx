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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const brandStatusColor = '#1a65ff';
const statusStyles = {
  published: {
    label: 'Veröffentlicht',
    dot: '#22c55e',
    color: brandStatusColor,
    chipBg: 'rgba(34, 197, 94, 0.15)',
    chipText: '#15803d',
  },
  draft: {
    label: 'Entwurf',
    dot: '#1a65ff',
    color: brandStatusColor,
    chipBg: 'rgba(26, 101, 255, 0.12)',
    chipText: '#1a65ff',
  },
  disabled: {
    label: 'Deaktiviert',
    dot: '#ef4444',
    color: brandStatusColor,
    chipBg: 'rgba(239, 68, 68, 0.15)',
    chipText: '#b91c1c',
  },
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

type LessonStatus = ChapterStatus;

type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  parentLessonId?: string | null;
  position: number;
  status?: LessonStatus;
  shortDescription?: string;
  content?: string;
};

const getChapterRootContainerId = (chapterId: string) => `chapter:${chapterId}:root`;
const getSubchapterContainerId = (chapterId: string, subchapterId: string) => `chapter:${chapterId}:sub:${subchapterId}`;

type LessonContainerMeta = {
  id: string;
  chapterId: string;
  parentLessonId: string | null;
  lessons: Lesson[];
};

type LessonContainerOverrides = Record<string, string[]>;

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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggingChapter, setDraggingChapter] = useState<Chapter | null>(null);
  const [draggingLesson, setDraggingLesson] = useState<Lesson | null>(null);
  const lessonContainerMap = useMemo<Record<string, LessonContainerMeta>>(() => {
    const map: Record<string, LessonContainerMeta> = {};
    chapters.forEach((chapter) => {
      const lessons = lessonsByChapter[chapter.id] ?? [];
      const rootContainerId = getChapterRootContainerId(chapter.id);
      map[rootContainerId] = {
        id: rootContainerId,
        chapterId: chapter.id,
        parentLessonId: null,
        lessons: lessons.filter((lesson) => lesson.type !== 'subchapter' && !lesson.parentLessonId),
      };
      lessons
        .filter((lesson) => lesson.type === 'subchapter')
        .forEach((subchapter) => {
          const containerId = getSubchapterContainerId(chapter.id, subchapter.id);
          map[containerId] = {
            id: containerId,
            chapterId: chapter.id,
            parentLessonId: subchapter.id,
            lessons: lessons.filter((lesson) => lesson.parentLessonId === subchapter.id),
          };
        });
    });
    return map;
  }, [chapters, lessonsByChapter]);

  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);
  const [lessonSaving, setLessonSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    if (!courseId) return new Set();
    try {
      const stored = localStorage.getItem(`expandedChapters_${courseId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [statusMenu, setStatusMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ anchorEl: HTMLElement | null; chapterId: string | null }>({
    anchorEl: null,
    chapterId: null,
  });
  const [lessonActionsMenu, setLessonActionsMenu] = useState<{ 
    anchorEl: HTMLElement | null; 
    chapterId: string | null; 
    lessonId: string | null;
  }>({
    anchorEl: null,
    chapterId: null,
    lessonId: null,
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
    if (!courseId) return;
    try {
      localStorage.setItem(`expandedChapters_${courseId}`, JSON.stringify([...expandedChapters]));
    } catch (error) {
      console.error('Failed to save expanded chapters', error);
    }
  }, [expandedChapters, courseId]);

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
    hasSyncedCountsRef.current = false;
    
    // Lade expandedChapters aus localStorage für den neuen courseId
    if (courseId) {
      try {
        const stored = localStorage.getItem(`expandedChapters_${courseId}`);
        setExpandedChapters(stored ? new Set(JSON.parse(stored)) : new Set());
      } catch {
        setExpandedChapters(new Set());
      }
    } else {
      setExpandedChapters(new Set());
    }
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
              status: (data.status as LessonStatus) ?? 'draft',
              shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
              content: typeof data.content === 'string' ? data.content : '',
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

  // Initialisiere Lektionen-Listener für aufgeklappte Kapitel
  useEffect(() => {
    if (chapters.length === 0 || expandedChapters.size === 0) {
      return;
    }
    expandedChapters.forEach((chapterId) => {
      ensureLessonsListener(chapterId);
    });
  }, [chapters, expandedChapters, ensureLessonsListener]);

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

  const handleLessonCardClick = (chapterId: string, lesson: Lesson) => {
    if (lesson.type !== 'text' || !courseId) {
      return;
    }
    navigate(`/courses/${courseId}/chapters/${chapterId}/lessons/${lesson.id}`);
  };


  const handleChapterInputChange = (field: keyof ChapterFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setChapterForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSelectChapterColor = (color: string) => {
    setChapterForm((prev) => ({ ...prev, coverColor: color }));
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
      const newLessonData: Record<string, unknown> = {
        title: lessonForm.title.trim(),
        type: lessonType,
        parentLessonId: lessonForm.parentLessonId ?? null,
        position: Date.now(),
        createdAt: serverTimestamp(),
        status: 'draft',
        shortDescription: '',
      };
      if (lessonType === 'text') {
        newLessonData.content = '';
      }
      await setDoc(lessonRef, newLessonData);
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

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!courseRef || !window.confirm('Lektion wirklich löschen?')) {
      return;
    }
    try {
      const chapterRef = doc(courseRef, 'chapters', chapterId);
      const lessonRef = doc(chapterRef, 'lessons', lessonId);
      const lessonSnapshot = await getDoc(lessonRef);
      
      if (!lessonSnapshot.exists()) {
        return;
      }
      
      const lessonData = lessonSnapshot.data();
      const lessonType = (lessonData.type as LessonType) ?? 'text';
      
      await deleteDoc(lessonRef);
      
      if (lessonType !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(-1) });
      }
      
      void refreshCourseAggregates();
    } catch (error) {
      setPageError('Lektion konnte nicht gelöscht werden.');
    }
  };

  const handleDuplicateLesson = async (chapterId: string, lessonId: string) => {
    if (!courseRef) {
      return;
    }
    try {
      const chapterRef = doc(courseRef, 'chapters', chapterId);
      const lessonRef = doc(chapterRef, 'lessons', lessonId);
      const lessonSnapshot = await getDoc(lessonRef);
      
      if (!lessonSnapshot.exists()) {
        return;
      }
      
      const lessonData = lessonSnapshot.data();
      const lessonType = (lessonData.type as LessonType) ?? 'text';
      
      const duplicatedLessonRef = doc(collection(chapterRef, 'lessons'));
      await setDoc(duplicatedLessonRef, {
        ...lessonData,
        title: `${lessonData.title || 'Lektion'} Kopie`,
        position: Date.now(),
        createdAt: serverTimestamp(),
      });
      
      if (lessonType !== 'subchapter') {
        await updateDoc(courseRef, { lessons: increment(1) });
      }
      
      void refreshCourseAggregates();
    } catch (error) {
      setPageError('Lektion konnte nicht dupliziert werden.');
    }
  };

  const handleLessonActionsMenuOpen = (chapterId: string, lessonId: string, anchorEl: HTMLElement) => {
    setLessonActionsMenu({ anchorEl, chapterId, lessonId });
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
    setLessonActionsMenu({ anchorEl: null, chapterId: null, lessonId: null });
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

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    if (!activeData) {
      return;
    }
    if (activeData.type === 'chapter') {
      setDraggingChapter(activeData.chapter as Chapter);
    } else if (activeData.type === 'lesson') {
      setDraggingLesson(activeData.lesson as Lesson);
    }
  };

  const handleDragCancel = () => {
    setDraggingChapter(null);
    setDraggingLesson(null);
  };

  const persistChapterPositions = async (orderedChapters: Chapter[]) => {
    if (!courseRef) {
      return;
    }
    const batch = writeBatch(db);
    orderedChapters.forEach((chapter, index) => {
      batch.update(doc(courseRef, 'chapters', chapter.id), { position: index });
    });
    await batch.commit();
  };

  const handleChapterReorder = async (activeId: string, overId: string) => {
    if (activeId === overId) {
      return;
    }
    const oldIndex = chapters.findIndex((chapter) => chapter.id === activeId);
    const newIndex = chapters.findIndex((chapter) => chapter.id === overId);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const reordered = arrayMove(chapters, oldIndex, newIndex);
    setChapters(reordered);
    try {
      await persistChapterPositions(reordered);
    } catch (error) {
      setPageError('Kapitelreihenfolge konnte nicht gespeichert werden.');
    }
  };

  const buildChapterOrder = (
    chapterId: string,
    overrides: LessonContainerOverrides,
    injectedLessons: Lesson[],
    removedLessonIds: string[],
  ) => {
    const baseLessons = lessonsByChapter[chapterId] ?? [];
    const filteredLessons = baseLessons.filter((lesson) => !removedLessonIds.includes(lesson.id));
    const combinedLessons = [...filteredLessons];
    injectedLessons.forEach((lesson) => {
      if (!combinedLessons.some((existing) => existing.id === lesson.id)) {
        combinedLessons.push(lesson);
      }
    });
    combinedLessons.sort((a, b) => a.position - b.position);
    const rootContainerId = getChapterRootContainerId(chapterId);
    const rootIds = overrides[rootContainerId] ?? combinedLessons
      .filter((lesson) => lesson.type !== 'subchapter' && !lesson.parentLessonId)
      .map((lesson) => lesson.id);
    const subchapters = combinedLessons.filter((lesson) => lesson.type === 'subchapter');
    const flattenIds: string[] = [...rootIds];
    subchapters.forEach((subchapter) => {
      flattenIds.push(subchapter.id);
      const containerId = getSubchapterContainerId(chapterId, subchapter.id);
      const originalChildren = combinedLessons.filter((lesson) => lesson.parentLessonId === subchapter.id);
      const childIds = overrides[containerId] ?? originalChildren.map((lesson) => lesson.id);
      flattenIds.push(...childIds);
    });
    combinedLessons
      .map((lesson) => lesson.id)
      .filter((id) => !flattenIds.includes(id))
      .forEach((id) => flattenIds.push(id));
    return flattenIds;
  };

  const persistChapterLessonOrder = async ({
    chapterId,
    overrides = {},
    parentOverrides = {},
    injectedLessons = [],
    removedLessonIds = [],
  }: {
    chapterId: string;
    overrides?: LessonContainerOverrides;
    parentOverrides?: Record<string, string | null>;
    injectedLessons?: Lesson[];
    removedLessonIds?: string[];
  }) => {
    if (!courseRef) {
      return;
    }
    const orderedIds = buildChapterOrder(chapterId, overrides, injectedLessons, removedLessonIds);
    const chapterRef = doc(courseRef, 'chapters', chapterId);
    const batch = writeBatch(db);
    orderedIds.forEach((lessonId, index) => {
      const lessonRef = doc(chapterRef, 'lessons', lessonId);
      const payload: Record<string, unknown> = { position: index };
      if (lessonId in parentOverrides) {
        payload.parentLessonId = parentOverrides[lessonId];
      }
      batch.update(lessonRef, payload);
    });
    await batch.commit();
  };

  const moveLessonBetweenChapters = async ({
    lessonId,
    sourceChapterId,
    targetChapterId,
    targetParentLessonId,
    sourceOverrides,
    targetOverrides,
  }: {
    lessonId: string;
    sourceChapterId: string;
    targetChapterId: string;
    targetParentLessonId: string | null;
    sourceOverrides: LessonContainerOverrides;
    targetOverrides: LessonContainerOverrides;
  }) => {
    if (!courseRef) {
      return;
    }
    const sourceChapterRef = doc(courseRef, 'chapters', sourceChapterId);
    const sourceLessonRef = doc(sourceChapterRef, 'lessons', lessonId);
    const snapshot = await getDoc(sourceLessonRef);
    if (!snapshot.exists()) {
      return;
    }
    const data = snapshot.data();
    const convertedLesson: Lesson = {
      id: lessonId,
      title: typeof data.title === 'string' ? data.title : 'Neue Lektion',
      type: (data.type as LessonType) ?? 'text',
      parentLessonId: typeof data.parentLessonId === 'string' ? data.parentLessonId : null,
      position: typeof data.position === 'number' ? data.position : 0,
      status: (data.status as LessonStatus) ?? 'draft',
      shortDescription: typeof data.shortDescription === 'string' ? data.shortDescription : '',
      content: typeof data.content === 'string' ? data.content : '',
    };
    const targetChapterRef = doc(courseRef, 'chapters', targetChapterId);
    const targetLessonRef = doc(targetChapterRef, 'lessons', lessonId);
    await setDoc(targetLessonRef, {
      ...data,
      parentLessonId: targetParentLessonId ?? null,
      position: 0,
    });
    await deleteDoc(sourceLessonRef);
    await persistChapterLessonOrder({
      chapterId: sourceChapterId,
      overrides: sourceOverrides,
      removedLessonIds: [lessonId],
    });
    await persistChapterLessonOrder({
      chapterId: targetChapterId,
      overrides: targetOverrides,
      parentOverrides: { [lessonId]: targetParentLessonId },
      injectedLessons: [{ ...convertedLesson, parentLessonId: targetParentLessonId ?? null }],
    });
  };

  const handleLessonDrop = async ({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }
    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData || activeData.type !== 'lesson') {
      return;
    }
    const destinationContainerId =
      overData?.type === 'lesson'
        ? (overData.containerId as string)
        : overData?.type === 'lesson-container'
          ? (overData.containerId as string)
          : null;
    if (!destinationContainerId) {
      return;
    }
    const sourceContainerId = activeData.containerId as string;
    const sourceMeta = lessonContainerMap[sourceContainerId];
    const targetMeta = lessonContainerMap[destinationContainerId];
    if (!sourceMeta || !targetMeta) {
      return;
    }
    if (destinationContainerId === sourceContainerId && over.id === active.id) {
      return;
    }
    const sourceIds = sourceMeta.lessons.map((lesson) => lesson.id);
    const targetIds =
      destinationContainerId === sourceContainerId ? sourceIds : targetMeta.lessons.map((lesson) => lesson.id);
    const activeIndex = sourceIds.indexOf(active.id as string);
    if (activeIndex === -1) {
      return;
    }
    let rawTargetIndex: number;
    if (overData?.type === 'lesson') {
      rawTargetIndex = targetIds.indexOf(over.id as string);
      if (rawTargetIndex === -1) {
        rawTargetIndex = targetIds.length;
      }
    } else {
      rawTargetIndex = targetIds.length;
    }
    const updatedSourceIds = [...sourceIds];
    updatedSourceIds.splice(activeIndex, 1);
    const baseTargetIds = destinationContainerId === sourceContainerId ? updatedSourceIds : [...targetIds];
    const targetIndex = Math.min(rawTargetIndex, baseTargetIds.length);
    const updatedTargetIds = [...baseTargetIds];
    updatedTargetIds.splice(targetIndex, 0, active.id as string);
    try {
      if (sourceMeta.chapterId === targetMeta.chapterId) {
        if (destinationContainerId === sourceContainerId) {
          if (sourceIds.join('|') === updatedTargetIds.join('|')) {
            return;
          }
          const parentOverride =
            sourceMeta.parentLessonId === targetMeta.parentLessonId
              ? {}
              : { [active.id as string]: targetMeta.parentLessonId };
          await persistChapterLessonOrder({
            chapterId: sourceMeta.chapterId,
            overrides: { [sourceContainerId]: updatedTargetIds },
            parentOverrides: parentOverride,
          });
        } else {
          await persistChapterLessonOrder({
            chapterId: sourceMeta.chapterId,
            overrides: {
              [sourceContainerId]: updatedSourceIds,
              [destinationContainerId]: updatedTargetIds,
            },
            parentOverrides: { [active.id as string]: targetMeta.parentLessonId },
          });
        }
      } else {
        await moveLessonBetweenChapters({
          lessonId: active.id as string,
          sourceChapterId: sourceMeta.chapterId,
          targetChapterId: targetMeta.chapterId,
          targetParentLessonId: targetMeta.parentLessonId,
          sourceOverrides: { [sourceContainerId]: updatedSourceIds },
          targetOverrides: { [destinationContainerId]: updatedTargetIds },
        });
      }
    } catch (error) {
      setPageError('Verschieben der Lektion ist fehlgeschlagen.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const type = event.active.data.current?.type;
    if (type === 'chapter' && event.over) {
      await handleChapterReorder(event.active.id as string, event.over.id as string);
    } else if (type === 'lesson') {
      await handleLessonDrop(event);
    }
    handleDragCancel();
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
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={chapters.map((chapter) => chapter.id)} strategy={verticalListSortingStrategy}>
                <Stack spacing={2.5}>
                  {chapters.map((chapter) => (
                    <ChapterCard
                      key={chapter.id}
                      chapter={chapter}
                      expanded={expandedChapters.has(chapter.id)}
                      onToggle={toggleChapter}
                      onStatusMenuOpen={handleStatusMenuOpen}
                      onActionsMenuOpen={handleActionsMenuOpen}
                      lessons={lessonsByChapter[chapter.id] ?? []}
                      onLessonClick={handleLessonCardClick}
                      onAddLesson={handleOpenLessonDialog}
                      onLessonActionsMenuOpen={handleLessonActionsMenuOpen}
                    />
                  ))}
                </Stack>
              </SortableContext>
              <DragOverlay>
                {draggingChapter ? (
                  <Paper
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      minWidth: 320,
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper,
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width: 48, height: 48, bgcolor: draggingChapter.coverColor || 'primary.main', color: '#fff' }}>
                        <FolderIcon />
                      </Avatar>
                      <Typography fontWeight={600}>{draggingChapter.title}</Typography>
                    </Stack>
                  </Paper>
                ) : draggingLesson ? (
                  <LessonDragPreview lesson={draggingLesson} />
                ) : null}
              </DragOverlay>
            </DndContext>
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

      <Menu
        anchorEl={lessonActionsMenu.anchorEl}
        open={Boolean(lessonActionsMenu.anchorEl)}
        onClose={handleCloseMenus}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            if (lessonActionsMenu.chapterId && lessonActionsMenu.lessonId) {
              handleDuplicateLesson(lessonActionsMenu.chapterId, lessonActionsMenu.lessonId);
            }
            handleCloseMenus();
          }}
        >
          Duplizieren
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (lessonActionsMenu.chapterId && lessonActionsMenu.lessonId) {
              handleDeleteLesson(lessonActionsMenu.chapterId, lessonActionsMenu.lessonId);
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

type LessonContainerProps = {
  containerId: string;
  chapterId: string;
  parentLessonId: string | null;
  lessons: Lesson[];
  children: (lessons: Lesson[]) => ReactNode;
};

const LessonContainer = ({ containerId, chapterId, parentLessonId, lessons, children }: LessonContainerProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
    data: { type: 'lesson-container', containerId, chapterId, parentLessonId },
  });
  return (
    <SortableContext items={lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
      <Box
        ref={setNodeRef}
        sx={{
          border: isOver ? '1px dashed #1d8bf2' : '1px dashed transparent',
          borderRadius: 2,
          transition: 'border 0.15s ease',
          p: isOver ? 1 : 0,
        }}
      >
        {children(lessons)}
      </Box>
    </SortableContext>
  );
};

const LessonDropPlaceholder = ({ label }: { label: string }) => (
  <Paper
    variant="outlined"
    sx={{
      borderRadius: 2,
      borderStyle: 'dashed',
      borderColor: 'rgba(148, 163, 184, 0.6)',
      color: 'text.secondary',
      textAlign: 'center',
      py: 1.5,
      px: 1,
      backgroundColor: 'transparent',
    }}
  >
    {label}
  </Paper>
);

type SortableLessonCardProps = {
  lesson: Lesson;
  chapterId: string;
  containerId: string;
  onLessonClick: (chapterId: string, lesson: Lesson) => void;
  onLessonActionsMenuOpen: (chapterId: string, lessonId: string, anchorEl: HTMLElement) => void;
};

const SortableLessonCard = ({ lesson, chapterId, containerId, onLessonClick, onLessonActionsMenuOpen }: SortableLessonCardProps) => {
  const typeConfig = lessonTypeConfig[lesson.type] ?? lessonTypeConfig.text;
  const lessonStatus = (lesson.status as LessonStatus) ?? 'draft';
  const statusConfig = statusStyles[lessonStatus];
  const isTextLesson = lesson.type === 'text';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    data: {
      type: 'lesson',
      lesson,
      containerId,
      chapterId,
      parentLessonId: lesson.parentLessonId ?? null,
    },
  });
  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        borderRadius: 2,
        p: 1.5,
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.default),
        cursor: isTextLesson ? 'pointer' : 'default',
        opacity: isDragging ? 0.6 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar 
          variant="rounded" 
          sx={{ width: 48, height: 48, bgcolor: typeConfig.color, color: '#fff' }}
          onClick={isTextLesson ? () => onLessonClick(chapterId, lesson) : undefined}
        >
          {typeConfig.icon}
        </Avatar>
        <Box 
          sx={{ flex: 1, cursor: isTextLesson ? 'pointer' : 'default' }}
          onClick={isTextLesson ? () => onLessonClick(chapterId, lesson) : undefined}
        >
          <Typography fontWeight={600}>{lesson.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {typeConfig.label}
          </Typography>
          {lesson.shortDescription ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {lesson.shortDescription}
            </Typography>
          ) : null}
        </Box>
        <Chip
          label={statusConfig.label}
          size="small"
          sx={{
            fontWeight: 600,
            color: statusConfig.chipText,
            backgroundColor: statusConfig.chipBg,
            borderRadius: 16,
            px: 1.25,
          }}
        />
        <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab' }}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <IconButton 
          size="small" 
          onClick={(event) => {
            event.stopPropagation();
            onLessonActionsMenuOpen(chapterId, lesson.id, event.currentTarget);
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

const LessonDragPreview = ({ lesson }: { lesson: Lesson }) => {
  const typeConfig = lessonTypeConfig[lesson.type] ?? lessonTypeConfig.text;
  const lessonStatus = (lesson.status as LessonStatus) ?? 'draft';
  const statusConfig = statusStyles[lessonStatus];
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        p: 1.5,
        width: 320,
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.default),
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: typeConfig.color, color: '#fff' }}>
          {typeConfig.icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={600}>{lesson.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {typeConfig.label}
          </Typography>
        </Box>
        <Chip
          label={statusConfig.label}
          size="small"
          sx={{
            fontWeight: 600,
            color: statusConfig.chipText,
            backgroundColor: statusConfig.chipBg,
            borderRadius: 16,
            px: 1.25,
          }}
        />
      </Stack>
    </Paper>
  );
};

type ChapterCardProps = {
  chapter: Chapter;
  expanded: boolean;
  onToggle: (chapterId: string) => void;
  onStatusMenuOpen: (chapterId: string, anchorEl: HTMLElement) => void;
  onActionsMenuOpen: (chapterId: string, anchorEl: HTMLElement) => void;
  lessons: Lesson[];
  onLessonClick: (chapterId: string, lesson: Lesson) => void;
  onAddLesson: (chapterId: string, parentLessonId?: string | null) => void;
  onLessonActionsMenuOpen: (chapterId: string, lessonId: string, anchorEl: HTMLElement) => void;
};

const ChapterCard = ({
  chapter,
  expanded,
  onToggle,
  onStatusMenuOpen,
  onActionsMenuOpen,
  lessons,
  onLessonClick,
  onAddLesson,
  onLessonActionsMenuOpen,
}: ChapterCardProps) => {
  const statusConfig = statusStyles[chapter.status];
  const avatarColor = chapter.coverColor || 'primary.main';
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
    data: { type: 'chapter', chapter },
  });
  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        borderRadius: 3,
        p: 3,
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#111325' : theme.palette.background.paper),
        opacity: isDragging ? 0.6 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
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
          onClick={(event) => onStatusMenuOpen(chapter.id, event.currentTarget)}
          startIcon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusConfig.dot }} />}
          sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {statusConfig.label}
        </Button>
        <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab' }}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <IconButton onClick={() => onToggle(chapter.id)}>
          {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
        <IconButton onClick={(event) => onActionsMenuOpen(chapter.id, event.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
      </Stack>
      {expanded ? (
        <Box mt={3}>
          <Divider sx={{ mb: 3 }} />
          <Box mb={subchapters.length ? 3 : 2}>
            <LessonContainer
              containerId={getChapterRootContainerId(chapter.id)}
              chapterId={chapter.id}
              parentLessonId={null}
              lessons={standaloneLessons}
            >
              {(items) =>
                items.length ? (
                  <Stack spacing={1.5}>
                    {items.map((lesson) => (
                      <SortableLessonCard
                        key={lesson.id}
                        lesson={lesson}
                        chapterId={chapter.id}
                        containerId={getChapterRootContainerId(chapter.id)}
                        onLessonClick={onLessonClick}
                        onLessonActionsMenuOpen={onLessonActionsMenuOpen}
                      />
                    ))}
                  </Stack>
                ) : (
                  <LessonDropPlaceholder label="Ziehe Lektionen hierher oder lege neue an." />
                )
              }
            </LessonContainer>
          </Box>
          {subchapters.map((subchapter) => {
            const children = lessonsByParent[subchapter.id] ?? [];
            const containerId = getSubchapterContainerId(chapter.id, subchapter.id);
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
                      onClick={() => onAddLesson(chapter.id, subchapter.id)}
                    >
                      Lektion hinzufügen
                    </Button>
                  </Stack>
                  <Box mt={2}>
                    <LessonContainer
                      containerId={containerId}
                      chapterId={chapter.id}
                      parentLessonId={subchapter.id}
                      lessons={children}
                    >
                      {(items) =>
                        items.length ? (
                          <Stack spacing={1.25}>
                            {items.map((lesson) => (
                              <SortableLessonCard
                                key={lesson.id}
                                lesson={lesson}
                                chapterId={chapter.id}
                                containerId={containerId}
                                onLessonClick={onLessonClick}
                                onLessonActionsMenuOpen={onLessonActionsMenuOpen}
                              />
                            ))}
                          </Stack>
                        ) : (
                          <LessonDropPlaceholder label="Noch keine Lektionen in diesem Unterkapitel." />
                        )
                      }
                    </LessonContainer>
                  </Box>
                </Paper>
              </Box>
            );
          })}
          {standaloneLessons.length === 0 && subchapters.length === 0 ? (
            <Typography variant="body2" color="text.secondary" mb={2}>
             
            </Typography>
          ) : null}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems="center"
          >
           
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              sx={{ textTransform: 'none' }}
              onClick={() => onAddLesson(chapter.id)}
            >
              Lektion hinzufügen
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Paper>
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
