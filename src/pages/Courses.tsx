import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Divider,
  Switch,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import FolderIcon from '@mui/icons-material/Folder';
import SchoolIcon from '@mui/icons-material/School';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CodeIcon from '@mui/icons-material/Code';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import CampaignIcon from '@mui/icons-material/Campaign';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MicIcon from '@mui/icons-material/Mic';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import ScienceIcon from '@mui/icons-material/Science';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import LanguageIcon from '@mui/icons-material/Language';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BrushIcon from '@mui/icons-material/Brush';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ComputerIcon from '@mui/icons-material/Computer';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PetsIcon from '@mui/icons-material/Pets';
import SpaIcon from '@mui/icons-material/Spa';
import SecurityIcon from '@mui/icons-material/Security';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CourseCard from '../components/CourseCard';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, writeBatch } from 'firebase/firestore';

type IconOption = {
  label: string;
  value: string;
  Icon: typeof FolderIcon;
  group: string;
  keywords?: string[];
};

const iconOptions = [
  { label: 'Allgemein', value: 'folder', Icon: FolderIcon, group: 'Basis', keywords: ['default', 'standard'] },
  { label: 'Lernen', value: 'school', Icon: SchoolIcon, group: 'Basis', keywords: ['education'] },
  { label: 'Ideen', value: 'idea', Icon: EmojiObjectsIcon, group: 'Basis', keywords: ['inspiration'] },
  { label: 'Video', value: 'video', Icon: PlayCircleOutlineIcon, group: 'Basis', keywords: ['media'] },
  { label: 'Community', value: 'people', Icon: PeopleAltIcon, group: 'Basis', keywords: ['team'] },
  { label: 'Programmierung', value: 'code', Icon: CodeIcon, group: 'Content', keywords: ['dev', 'software'] },
  { label: 'Design', value: 'design', Icon: DesignServicesIcon, group: 'Content', keywords: ['ui', 'ux'] },
  { label: 'Marketing', value: 'campaign', Icon: CampaignIcon, group: 'Business', keywords: ['ads'] },
  { label: 'Musik', value: 'music', Icon: MusicNoteIcon, group: 'Content' },
  { label: 'Podcast', value: 'podcast', Icon: MicIcon, group: 'Content', keywords: ['audio'] },
  { label: 'Kamera', value: 'camera', Icon: CameraAltIcon, group: 'Content', keywords: ['foto'] },
  { label: 'Computer', value: 'computer', Icon: ComputerIcon, group: 'Content', keywords: ['tech'] },
  { label: 'Gaming', value: 'gaming', Icon: SportsEsportsIcon, group: 'Content', keywords: ['esports'] },
  { label: 'AI & Bots', value: 'bots', Icon: SmartToyIcon, group: 'Content', keywords: ['automation'] },
  { label: 'Support', value: 'support', Icon: SupportAgentIcon, group: 'Business', keywords: ['service'] },
  { label: 'Business', value: 'business', Icon: WorkOutlineIcon, group: 'Business' },
  { label: 'Finanzen', value: 'finance', Icon: AttachMoneyIcon, group: 'Business', keywords: ['money'] },
  { label: 'E-Commerce', value: 'store', Icon: StorefrontIcon, group: 'Business', keywords: ['shop', 'commerce'] },
  { label: 'Vertrieb', value: 'sales', Icon: TrendingUpIcon, group: 'Business', keywords: ['sales'] },
  { label: 'Produkte', value: 'products', Icon: ShoppingBagIcon, group: 'Business', keywords: ['shop'] },
  { label: 'Events', value: 'events', Icon: EmojiEventsIcon, group: 'Business', keywords: ['live'] },
  { label: 'Coaching', value: 'coaching', Icon: PsychologyIcon, group: 'Business', keywords: ['mindset'] },
  { label: 'Inspiration', value: 'spark', Icon: AutoAwesomeIcon, group: 'Business' },
  { label: 'Kunst', value: 'art', Icon: BrushIcon, group: 'Lifestyle', keywords: ['creative', 'drawing'] },
  { label: 'Lesen', value: 'reading', Icon: MenuBookIcon, group: 'Lifestyle', keywords: ['buch'] },
  { label: 'Kulinarik', value: 'food', Icon: RestaurantMenuIcon, group: 'Lifestyle', keywords: ['cooking'] },
  { label: 'Fitness', value: 'fitness', Icon: FitnessCenterIcon, group: 'Lifestyle', keywords: ['sport'] },
  { label: 'Mindfulness', value: 'mindfulness', Icon: SelfImprovementIcon, group: 'Lifestyle', keywords: ['mental'] },
  { label: 'Wellness', value: 'wellness', Icon: SpaIcon, group: 'Lifestyle', keywords: ['health'] },
  { label: 'Wissenschaft', value: 'science', Icon: ScienceIcon, group: 'Lifestyle', keywords: ['lab'] },
  { label: 'Reisen', value: 'travel', Icon: TravelExploreIcon, group: 'Lifestyle', keywords: ['adventure'] },
  { label: 'Sprachen', value: 'language', Icon: LanguageIcon, group: 'Lifestyle', keywords: ['sprachkurs'] },
  { label: 'Haustiere', value: 'pets', Icon: PetsIcon, group: 'Lifestyle', keywords: ['tier'] },
  { label: 'Sicherheit', value: 'security', Icon: SecurityIcon, group: 'Lifestyle', keywords: ['privacy'] },
  { label: 'Teams', value: 'teams', Icon: GroupsIcon, group: 'Community', keywords: ['crew'] },
  { label: 'Freiwilligenarbeit', value: 'volunteer', Icon: VolunteerActivismIcon, group: 'Community', keywords: ['help'] },
  { label: 'Gesundheit', value: 'health', Icon: HealthAndSafetyIcon, group: 'Community', keywords: ['medizin'] },
  { label: 'Unterstützung', value: 'supporters', Icon: SupportAgentIcon, group: 'Community', keywords: ['service'] },
] as const satisfies ReadonlyArray<IconOption>;

type CategoryIconKey = (typeof iconOptions)[number]['value'];

const iconOptionsList: ReadonlyArray<IconOption> = iconOptions;

const categoryIconMap: Record<CategoryIconKey, typeof FolderIcon> = iconOptions.reduce(
  (map, option) => {
    map[option.value as CategoryIconKey] = option.Icon;
    return map;
  },
  {} as Record<CategoryIconKey, typeof FolderIcon>,
);

type Category = {
  id: string;
  name: string;
  icon: CategoryIconKey;
  showInFilters?: boolean;
};

type Course = {
  id: string;
  title: string;
  description: string;
  chapters: number;
  lessons: number;
  duration: string;
  categoryIds: string[];
  coverImageUrl?: string;
  coverColor?: string;
};

type CategoryFormState = {
  name: string;
  icon: CategoryIconKey;
};

type CourseFormState = {
  title: string;
  description: string;
  categoryIds: string[];
};

const emptyCourseForm: CourseFormState = {
  title: '',
  description: '',
  categoryIds: [],
};

const Courses = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: '',
    icon: iconOptions[0].value,
  });
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [draggingCourseId, setDraggingCourseId] = useState<string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const coursesRef = useRef<Course[]>([]);
  const categoriesRef = useRef<Category[]>([]);
  const statsSyncedRef = useRef<Record<string, boolean>>({});

  const updateCourses = (updater: (prev: Course[]) => Course[]) => {
    setCourses((prev) => {
      const next = updater(prev);
      coursesRef.current = next;
      return next;
    });
  };

  const updateCategories = (updater: (prev: Category[]) => Category[]) => {
    setCategories((prev) => {
      const next = updater(prev);
      categoriesRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      updateCategories(() => []);
      updateCourses(() => []);
      return undefined;
    }

    const categoriesQuery = query(collection(db, 'users', currentUser.uid, 'categories'));
    const unsubscribeCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const loadedCategories: Category[] = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            const icon = (data.icon as CategoryIconKey) || 'folder';
            return {
              id: docSnapshot.id,
              name: data.name ?? 'Neue Kategorie',
              icon: iconOptions.some((option) => option.value === icon) ? icon : 'folder',
              showInFilters: data.showInFilters !== false,
              position: typeof data.position === 'number' ? data.position : Number.MAX_SAFE_INTEGER,
            };
          })
          .sort((a, b) => a.position - b.position)
          .map(({ position, ...category }) => category);
        categoriesRef.current = loadedCategories;
        setCategories(loadedCategories);
      },
      (error) => {
        console.error('Kategorien konnten nicht geladen werden', error);
      },
    );

    const coursesQuery = query(collection(db, 'users', currentUser.uid, 'courses'));
    const unsubscribeCourses = onSnapshot(
      coursesQuery,
      (snapshot) => {
        const loadedCourses: Course[] = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              title: data.title ?? 'Unbenannter Kurs',
              description: data.description ?? '',
              chapters: typeof data.chapters === 'number' ? data.chapters : 0,
              lessons: typeof data.lessons === 'number' ? data.lessons : 0,
              duration: typeof data.duration === 'string' ? data.duration : '0:00',
              categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds : [],
              coverImageUrl:
                typeof data.coverImageUrl === 'string' && data.coverImageUrl.trim().length > 0
                  ? data.coverImageUrl
                  : undefined,
              coverColor:
                typeof data.coverColor === 'string' && data.coverColor.trim().length > 0
                  ? data.coverColor
                  : undefined,
              position: typeof data.position === 'number' ? data.position : Number.MAX_SAFE_INTEGER,
            };
          })
          .sort((a, b) => a.position - b.position)
          .map(({ position, ...course }) => course);
        coursesRef.current = loadedCourses;
        setCourses(loadedCourses);
      },
      (error) => {
        console.error('Kurse konnten nicht geladen werden', error);
      },
    );

    return () => {
      unsubscribeCategories();
      unsubscribeCourses();
    };
  }, [currentUser]);

  useEffect(() => {
    setSelectedCategory('all');
  }, [currentUser]);

  useEffect(() => {
    statsSyncedRef.current = {};
  }, [currentUser?.uid]);

  const persistCategoryOrder = async (nextCategories: Category[]) => {
    if (!currentUser) {
      return;
    }
    try {
      const batch = writeBatch(db);
      nextCategories.forEach((category, index) => {
        const categoryRef = doc(db, 'users', currentUser.uid, 'categories', category.id);
        batch.set(categoryRef, { position: index }, { merge: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Kategorie-Reihenfolge konnte nicht gespeichert werden', error);
    }
  };

  const persistCourseOrder = async (nextCourses: Course[]) => {
    if (!currentUser) {
      return;
    }
    try {
      const batch = writeBatch(db);
      nextCourses.forEach((course, index) => {
        const courseRef = doc(db, 'users', currentUser.uid, 'courses', course.id);
        batch.set(courseRef, { position: index }, { merge: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Kurs-Reihenfolge konnte nicht gespeichert werden', error);
    }
  };

  const transparentDragImage = useMemo(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    return canvas;
  }, []);

  const syncCourseStats = useCallback(
    async (course: Course) => {
      if (!currentUser) {
        return;
      }
      try {
        const courseRef = doc(db, 'users', currentUser.uid, 'courses', course.id);
        const chaptersCollectionRef = collection(courseRef, 'chapters');
        const chaptersSnapshot = await getDocs(chaptersCollectionRef);
        const chapterCount = chaptersSnapshot.size;
        let lessonCount = 0;
        if (chapterCount > 0) {
          const lessonCounts = await Promise.all(
            chaptersSnapshot.docs.map(async (chapterDoc) => {
              const lessonsCollectionRef = collection(chapterDoc.ref, 'lessons');
              const lessonsSnapshot = await getDocs(lessonsCollectionRef);
              return lessonsSnapshot.docs.reduce((total, lessonDoc) => {
                const data = lessonDoc.data();
                return data.type === 'subchapter' ? total : total + 1;
              }, 0);
            }),
          );
          lessonCount = lessonCounts.reduce((total, count) => total + count, 0);
        }
        updateCourses((prev) =>
          prev.map((item) =>
            item.id === course.id ? { ...item, chapters: chapterCount, lessons: lessonCount } : item,
          ),
        );
        await setDoc(
          courseRef,
          { chapters: chapterCount, lessons: lessonCount },
          { merge: true },
        );
      } catch (error) {
        statsSyncedRef.current[course.id] = false;
        console.error(`Kurszahlen konnten nicht geladen werden (${course.id})`, error);
      }
    },
    [currentUser, updateCourses],
  );


  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = `${course.title} ${course.description}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'uncategorized'
            ? course.categoryIds.length === 0
            : course.categoryIds.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [courses, searchTerm, selectedCategory]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.showInFilters !== false),
    [categories],
  );

  useEffect(() => {
    courses.forEach((course) => {
      if (statsSyncedRef.current[course.id]) {
        return;
      }
      if (course.chapters > 0 || course.lessons > 0) {
        statsSyncedRef.current[course.id] = true;
        return;
      }
      statsSyncedRef.current[course.id] = true;
      void syncCourseStats(course);
    });
  }, [courses, syncCourseStats]);

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({ name: category.name, icon: category.icon });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({ name: '', icon: iconOptions[0].value });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !currentUser) {
      return;
    }
    try {
      if (editingCategoryId) {
        let updatedCategories: Category[] = categoriesRef.current;
        updateCategories((prev) => {
          updatedCategories = prev.map((cat) => (cat.id === editingCategoryId ? { ...cat, ...categoryForm } : cat));
          return updatedCategories;
        });
        const categoryRef = doc(db, 'users', currentUser.uid, 'categories', editingCategoryId);
        await setDoc(
          categoryRef,
          { name: categoryForm.name, icon: categoryForm.icon },
          { merge: true },
        );
        await persistCategoryOrder(updatedCategories);
      } else {
        const categoryRef = doc(collection(db, 'users', currentUser.uid, 'categories'));
        const newCategory: Category = { id: categoryRef.id, ...categoryForm, showInFilters: true };
        let updatedCategories: Category[] = categoriesRef.current;
        updateCategories((prev) => {
          updatedCategories = [...prev, newCategory];
          return updatedCategories;
        });
        await setDoc(categoryRef, {
          name: newCategory.name,
          icon: newCategory.icon,
          showInFilters: true,
          position: updatedCategories.length - 1,
        });
        await persistCategoryOrder(updatedCategories);
      }
      setCategoryDialogOpen(false);
    } catch (error) {
      console.error('Kategorie konnte nicht gespeichert werden', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!currentUser) {
      return;
    }
    const coursesNeedingUpdate: Course[] = [];
    let updatedCategories: Category[] = categoriesRef.current;
    updateCategories((prev) => {
      updatedCategories = prev.filter((cat) => cat.id !== categoryId);
      return updatedCategories;
    });
    updateCourses((prev) =>
      prev.map((course) => {
        if (!course.categoryIds.includes(categoryId)) {
          return course;
        }
        const updatedCourse = {
          ...course,
          categoryIds: course.categoryIds.filter((id) => id !== categoryId),
        };
        coursesNeedingUpdate.push(updatedCourse);
        return updatedCourse;
      }),
    );
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'categories', categoryId));
      await persistCategoryOrder(updatedCategories);
      await Promise.all(
        coursesNeedingUpdate.map((course) =>
          setDoc(doc(db, 'users', currentUser.uid, 'courses', course.id), { categoryIds: course.categoryIds }, { merge: true }),
        ),
      );
    } catch (error) {
      console.error('Kategorie konnte nicht gelöscht werden', error);
    }
    if (selectedCategory === categoryId) {
      setSelectedCategory('all');
    }
  };

  const handleToggleCategoryVisibility = async (categoryId: string, isVisible: boolean) => {
    updateCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, showInFilters: isVisible } : category,
      ),
    );
    if (!isVisible && selectedCategory === categoryId) {
      setSelectedCategory('all');
    }
    if (!currentUser) {
      return;
    }
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'categories', categoryId),
        { showInFilters: isVisible },
        { merge: true },
      );
    } catch (error) {
      console.error('Kategorie-Sichtbarkeit konnte nicht gespeichert werden', error);
    }
  };

  const handleOpenCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourseId(course.id);
      setCourseForm({
        title: course.title,
        description: course.description,
        categoryIds: course.categoryIds,
      });
    } else {
      setEditingCourseId(null);
      setCourseForm({ ...emptyCourseForm });
    }
    setCourseDialogOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim() || !currentUser) {
      return;
    }
    try {
      if (editingCourseId) {
        let updatedCourses: Course[] = coursesRef.current;
        updateCourses((prev) => {
          updatedCourses = prev.map((course) =>
            course.id === editingCourseId
              ? {
                  ...course,
                  title: courseForm.title,
                  description: courseForm.description,
                  categoryIds: courseForm.categoryIds,
                }
              : course,
          );
          return updatedCourses;
        });
        await setDoc(
          doc(db, 'users', currentUser.uid, 'courses', editingCourseId),
          {
            title: courseForm.title,
            description: courseForm.description,
            categoryIds: courseForm.categoryIds,
          },
          { merge: true },
        );
      } else {
        const courseRef = doc(collection(db, 'users', currentUser.uid, 'courses'));
        const newCourse: Course = {
          id: courseRef.id,
          title: courseForm.title,
          description: courseForm.description,
          chapters: 0,
          lessons: 0,
          duration: '0:00',
          categoryIds: courseForm.categoryIds,
          coverImageUrl: undefined,
          coverColor: undefined,
        };
        let updatedCourses: Course[] = coursesRef.current;
        updateCourses((prev) => {
          updatedCourses = [newCourse, ...prev];
          return updatedCourses;
        });
        await setDoc(courseRef, {
          title: newCourse.title,
          description: newCourse.description,
          categoryIds: newCourse.categoryIds,
          chapters: newCourse.chapters,
          lessons: newCourse.lessons,
          duration: newCourse.duration,
          coverImageUrl: newCourse.coverImageUrl ?? '',
          coverColor: newCourse.coverColor ?? '',
          position: 0,
        });
        await persistCourseOrder(updatedCourses);
      }
      setCourseDialogOpen(false);
    } catch (error) {
      console.error('Kurs konnte nicht gespeichert werden', error);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!currentUser) {
      return;
    }
    let updatedCourses: Course[] = coursesRef.current;
    updateCourses((prev) => {
      updatedCourses = prev.filter((course) => course.id !== id);
      return updatedCourses;
    });
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'courses', id));
      await persistCourseOrder(updatedCourses);
    } catch (error) {
      console.error('Kurs konnte nicht gelöscht werden', error);
    }
  };

  const renderCategoryIcon = (iconKey?: CategoryIconKey) => {
    const IconComponent = iconKey ? categoryIconMap[iconKey] ?? FolderIcon : FolderIcon;
    return <IconComponent fontSize="small" />;
  };

  const handleCourseCategoryChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    setCourseForm((prev) => ({
      ...prev,
      categoryIds: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, courseId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', courseId);
    if (transparentDragImage) {
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    }
    setDraggingCourseId(courseId);
  };

  const handleDragOverCourse = (event: DragEvent<HTMLDivElement>, targetCourseId: string) => {
    event.preventDefault();
    if (draggingCourseId === null || draggingCourseId === targetCourseId) {
      return;
    }
    updateCourses((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((course) => course.id === draggingCourseId);
      const toIndex = updated.findIndex((course) => course.id === targetCourseId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const [movedCourse] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedCourse);
      return updated;
    });
  };

  const handleDropOnCourse = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingCourseId) {
      void persistCourseOrder(coursesRef.current);
    }
    setDraggingCourseId(null);
  };

  const handleDragOverEndZone = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDropAtEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingCourseId === null) {
      return;
    }
    let updatedCourses: Course[] = coursesRef.current;
    updateCourses((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((course) => course.id === draggingCourseId);
      if (fromIndex === -1 || fromIndex === updated.length - 1) {
        updatedCourses = prev;
        return prev;
      }
      const [movedCourse] = updated.splice(fromIndex, 1);
      updated.push(movedCourse);
      updatedCourses = updated;
      return updated;
    });
    if (draggingCourseId) {
      void persistCourseOrder(updatedCourses);
    }
    setDraggingCourseId(null);
  };

  const handleDragEnd = () => {
    if (draggingCourseId) {
      setDraggingCourseId(null);
      void persistCourseOrder(coursesRef.current);
    }
  };

  const handleCategoryDragStart = (event: DragEvent<HTMLLIElement>, categoryId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', categoryId);
    setDraggingCategoryId(categoryId);
  };

  const handleCategoryDragOver = (event: DragEvent<HTMLLIElement>, targetCategoryId: string) => {
    event.preventDefault();
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      return;
    }
    updateCategories((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((category) => category.id === draggingCategoryId);
      const toIndex = updated.findIndex((category) => category.id === targetCategoryId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return prev;
      }
      const [movedCategory] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedCategory);
      return updated;
    });
  };

  const handleCategoryDrop = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    if (draggingCategoryId) {
      void persistCategoryOrder(categoriesRef.current);
    }
    setDraggingCategoryId(null);
  };

  const handleCategoryDragOverEndZone = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleCategoryDropAtEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingCategoryId) {
      return;
    }
    let updatedCategories: Category[] = categoriesRef.current;
    updateCategories((prev) => {
      const updated = [...prev];
      const fromIndex = updated.findIndex((category) => category.id === draggingCategoryId);
      if (fromIndex === -1 || fromIndex === updated.length - 1) {
        updatedCategories = prev;
        return prev;
      }
      const [movedCategory] = updated.splice(fromIndex, 1);
      updated.push(movedCategory);
      updatedCategories = updated;
      return updated;
    });
    void persistCategoryOrder(updatedCategories);
    setDraggingCategoryId(null);
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 1160,
        mx: 'auto',
        width: '100%',
      }}
    >
      <Box mb={4}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Kursübersicht
        </Typography>
        <Typography color="text.secondary">
          Verwalte deine Lerninhalte an einem Ort.
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        mb={3}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}
      >
        <TextField
          placeholder="Kurse durchsuchen"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{
            flex: { xs: '1 1 100%', md: '0 0 360px' },
            maxWidth: { md: 420 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
            },
          }}
        />
        <Button
          variant="outlined"
          startIcon={<TuneIcon />}
          sx={{
            whiteSpace: 'nowrap',
            px: 2.5,
            minHeight: 44,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: (theme) => theme.palette.mode === 'dark' ? '#1a65ff' : undefined,
            color: (theme) => theme.palette.mode === 'dark' ? '#1a65ff' : undefined,
            '&:hover': {
              borderColor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(26,101,255,0.12)' : undefined),
            },
          }}
          onClick={() => setCategoryDrawerOpen(true)}
        >
          Kategorien
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenCourseDialog()}
          sx={{
            whiteSpace: 'nowrap',
            px: 3,
            minHeight: 44,
            ml: { md: 'auto' },
            textTransform: 'none',
            alignSelf: { xs: 'stretch', md: 'center' },
            flexShrink: 0,
            fontWeight: 700,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
            '&:hover': {
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1a65ff' : undefined),
              filter: (theme) => (theme.palette.mode === 'dark' ? 'brightness(1.05)' : undefined),
            },
          }}
        >
          Kurs erstellen
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
        <Chip
          label="Alle"
          icon={<CategoryIcon fontSize="small" />}
          onClick={() => setSelectedCategory('all')}
          color={selectedCategory === 'all' ? 'primary' : 'default'}
        />
        <Chip
          label="Ohne Kategorie"
          onClick={() => setSelectedCategory('uncategorized')}
          color={selectedCategory === 'uncategorized' ? 'primary' : 'default'}
        />
        {visibleCategories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            icon={renderCategoryIcon(category.icon)}
            onClick={() => setSelectedCategory(category.id)}
            color={selectedCategory === category.id ? 'primary' : 'default'}
            sx={{
              fontWeight: 600,
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                backgroundColor: (theme) =>
                  selectedCategory === category.id
                    ? theme.palette.primary.light
                    : theme.palette.action.hover,
              },
            }}
          />
        ))}
      </Stack>

      <Box>
        {filteredCourses.length === 0 ? (
          <Box
            sx={{
              border: (theme) => `1px dashed ${theme.palette.divider}`,
              borderRadius: 3,
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Keine Kurse gefunden
            </Typography>
            <Typography color="text.secondary" mb={2}>
              Passe die Suche oder Kategorie an oder erstelle deinen ersten Kurs.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCourseDialog()}>
              Kurs anlegen
            </Button>
          </Box>
        ) : (
          <>
            {filteredCourses.map((course) => {
              const isDragging = draggingCourseId === course.id;
              return (
                <Box
                  key={course.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, course.id)}
                  onDragOver={(event) => handleDragOverCourse(event, course.id)}
                  onDrop={handleDropOnCourse}
                  onDragEnd={handleDragEnd}
                  sx={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    mb: 2.5,
                    opacity: isDragging ? 0.7 : 1,
                    transform: isDragging ? 'scale(1.02)' : 'none',
                    transition: 'opacity 0.1s ease, transform 0.1s ease',
                  }}
                >
                  <CourseCard
                    title={course.title}
                    description={course.description}
                    chapters={course.chapters}
                    lessons={course.lessons}
                    duration={course.duration}
                    coverImageUrl={course.coverImageUrl}
                    onEdit={() => handleOpenCourseDialog(course)}
                    onDelete={() => handleDeleteCourse(course.id)}
                    onOpen={() => navigate(`/courses/${course.id}`)}
                    coverColor={course.coverColor}
                  />
                </Box>
              );
            })}
            <Box onDragOver={handleDragOverEndZone} onDrop={handleDropAtEnd} sx={{ height: 24 }} />
          </>
        )}
      </Box>

      <Drawer anchor="right" open={categoryDrawerOpen} onClose={() => setCategoryDrawerOpen(false)}>
        <Box
          sx={{
            width: { xs: 320, sm: 380 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 3,
            gap: 2,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Kategorien
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Verwalte Namen, Symbole und Zuordnungen.
              </Typography>
            </Box>
            <IconButton onClick={() => setCategoryDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          <List sx={{ flex: 1, overflowY: 'auto' }}>
            {categories.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="body1" gutterBottom>
                  Noch keine Kategorien.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lege deine erste Kategorie an, um Kurse zu strukturieren.
                </Typography>
              </Box>
            ) : (
              <>
                {categories.map((category) => {
                  const IconComponent = categoryIconMap[category.icon];
                  const usage = courses.filter((course) => course.categoryIds.includes(category.id)).length;
                  const isCategoryDragging = draggingCategoryId === category.id;
                  return (
                    <ListItem
                      key={category.id}
                      draggable
                      onDragStart={(event) => handleCategoryDragStart(event, category.id)}
                      onDragOver={(event) => handleCategoryDragOver(event, category.id)}
                      onDrop={handleCategoryDrop}
                      onDragEnd={handleCategoryDrop}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        bgcolor: isCategoryDragging ? 'action.hover' : 'transparent',
                        transition: 'background-color 0.15s ease, transform 0.15s ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: isCategoryDragging ? 'none' : 'translateX(4px)',
                        },
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Switch
                            size="small"
                            checked={category.showInFilters !== false}
                            onChange={(event) => handleToggleCategoryVisibility(category.id, event.target.checked)}
                            inputProps={{ 'aria-label': 'Kategorie in Filter anzeigen' }}
                          />
                          <IconButton size="small" onClick={() => handleOpenCategoryDialog(category)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteCategory(category.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 28, color: 'text.disabled' }}>
                        <DragIndicatorIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary' }}>
                          <IconComponent fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={category.name}
                        secondary={`${usage} Kurs${usage === 1 ? '' : 'e'}`}
                      />
                    </ListItem>
                  );
                })}
                <Box onDragOver={handleCategoryDragOverEndZone} onDrop={handleCategoryDropAtEnd} sx={{ height: 16 }} />
              </>
            )}
          </List>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenCategoryDialog()}
            sx={{ mt: 1, py: 1.5, fontWeight: 700 }}
          >
            Neue Kategorie erstellen
          </Button>
        </Box>
      </Drawer>

      {/* Kategorie Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingCategoryId ? 'Kategorie bearbeiten' : 'Kategorie erstellen'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Neuer Kategoriename"
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
            fullWidth
            margin="normal"
          />
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Kategorie-Symbol
          </Typography>
          <Box
            sx={{
              maxHeight: (theme) => theme.spacing(45),
              overflowY: 'auto',
              pr: 1,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 0.75,
                gridAutoRows: (theme) => theme.spacing(7.5),
              }}
            >
              {iconOptionsList.map((option) => {
                const IconComponent = categoryIconMap[option.value as CategoryIconKey];
                const selected = categoryForm.icon === option.value;
                return (
                  <Box key={option.value}>
                    <Tooltip title={option.label} arrow>
                      <IconButton
                        onClick={() => setCategoryForm((prev) => ({ ...prev, icon: option.value as CategoryIconKey }))}
                        sx={{
                          width: '100%',
                          borderRadius: 2,
                          border: (theme) => `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                          backgroundColor: (theme) => (selected ? theme.palette.action.selected : 'transparent'),
                        }}
                      >
                        <IconComponent />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ width: '100%', maxWidth: 520, justifyContent: 'flex-end', mx: 'auto' }}
          >
            <Button onClick={() => setCategoryDialogOpen(false)}>Abbrechen</Button>
            <Button variant="contained" onClick={handleSaveCategory}>
              Speichern
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Kurs Dialog */}
      <Dialog open={courseDialogOpen} onClose={() => setCourseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCourseId ? 'Kurs bearbeiten' : 'Kurs erstellen'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Kursname"
              value={courseForm.title}
              onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beschreibung"
              value={courseForm.description}
              onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel id="course-categories-label">Kategorien</InputLabel>
              <Select
                labelId="course-categories-label"
                multiple
                value={courseForm.categoryIds}
                label="Kategorien"
                onChange={handleCourseCategoryChange}
                renderValue={(selected) =>
                  selected.length
                    ? categories
                        .filter((category) => selected.includes(category.id))
                        .map((category) => category.name)
                        .join(', ')
                    : 'Keine Kategorie'
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    <Checkbox checked={courseForm.categoryIds.includes(category.id)} />
                    <ListItemText primary={category.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ width: '100%', maxWidth: 520, justifyContent: 'flex-end', mx: 'auto' }}
          >
            <Button onClick={() => setCourseDialogOpen(false)}>Abbrechen</Button>
            <Button variant="contained" onClick={handleSaveCourse}>
              Speichern
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
      </Box>
    );
  };

  export default Courses;
