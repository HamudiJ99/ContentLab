import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  OutlinedInput,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { auth, db } from '../firebase/firebaseConfig';

type MemberStatus = 'invited' | 'active' | 'inactive';
type MemberRole = 'member' | 'admin';

type Member = {
  id: string;
  name: string;
  email: string;
  status: MemberStatus;
  role: MemberRole;
  createdAt?: Date | null;
  lastLogin?: Date | null;
  loginCount?: number;
  groupIds: string[];
  assignedCourseIds: string[];
};

type MemberGroup = {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date | null;
  assignedCourseIds: string[];
};

type Course = {
  id: string;
  title: string;
  description?: string;
  lessons: number;
  coverImageUrl?: string;
  coverColor?: string;
  chapters?: number;
};

type MemberSortOption = 'date-desc' | 'name-asc';

const statusConfig: Record<MemberStatus, { label: string; color: 'default' | 'success' | 'warning' | 'primary' }> = {
  invited: { label: 'Eingeladen', color: 'primary' },
  active: { label: 'Aktiv', color: 'success' },
  inactive: { label: 'Inaktiv', color: 'default' },
};

const roleOptions: { value: MemberRole; label: string }[] = [
  { value: 'member', label: 'Mitglied' },
  { value: 'admin', label: 'Admin' },
];

const formatDateTime = (value?: Date | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
};

const initials = (text: string) => {
  if (!text) return '?';
  const segments = text.trim().split(' ').filter(Boolean);
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase();
  return (segments[0][0] + segments[segments.length - 1][0]).toUpperCase();
};

export default function Members() {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState<MemberSortOption>('date-desc');
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MemberGroup | null>(null);
  const [selectedGroupCourseIds, setSelectedGroupCourseIds] = useState<string[]>([]);
  const [initialGroupCourseIds, setInitialGroupCourseIds] = useState<string[]>([]);
  const [groupDrawerSaving, setGroupDrawerSaving] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [initialCourseIds, setInitialCourseIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'member' as MemberRole });
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addGroupLoading, setAddGroupLoading] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'success' | 'error' | 'info' });
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteMemberLoading, setDeleteMemberLoading] = useState(false);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMembers([]);
      setGroups([]);
      setCourses([]);
      setLoadingMembers(false);
      setLoadingGroups(false);
      setLoadingCourses(false);
      return;
    }
    void Promise.all([loadMembers(currentUser), loadGroups(currentUser), loadCourses(currentUser)]);
  }, [currentUser]);

  const loadMembers = async (user: User) => {
    setLoadingMembers(true);
    try {
      const membersSnapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'members'), orderBy('createdAt', 'desc'))
      );
      const loadedMembers: Member[] = membersSnapshot.docs.map((memberDoc) => {
        const data = memberDoc.data();
        return {
          id: memberDoc.id,
          name: data.name ?? 'Unbenanntes Mitglied',
          email: data.email ?? '',
          status: (data.status as MemberStatus) ?? 'inactive',
          role: (data.role as MemberRole) ?? 'member',
          createdAt: data.createdAt?.toDate?.() ?? null,
          lastLogin: data.lastLogin?.toDate?.() ?? null,
          loginCount: data.loginCount ?? 0,
          groupIds: Array.isArray(data.groupIds) ? data.groupIds : [],
          assignedCourseIds: Array.isArray(data.assignedCourseIds) ? data.assignedCourseIds : [],
        };
      });
      setMembers(loadedMembers);
    } catch (error) {
      console.error('Mitglieder konnten nicht geladen werden', error);
      setSnackbar({ open: true, message: 'Mitglieder konnten nicht geladen werden.', severity: 'error' });
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadGroups = async (user: User) => {
    setLoadingGroups(true);
    try {
      const groupsSnapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'memberGroups'), orderBy('createdAt', 'desc'))
      );
      const loadedGroups: MemberGroup[] = groupsSnapshot.docs.map((groupDoc) => {
        const data = groupDoc.data();
        return {
          id: groupDoc.id,
          name: data.name ?? 'Neue Gruppe',
          description: data.description ?? '',
          createdAt: data.createdAt?.toDate?.() ?? null,
          assignedCourseIds: Array.isArray(data.assignedCourseIds) ? data.assignedCourseIds : [],
        };
      });
      setGroups(loadedGroups);
    } catch (error) {
      console.error('Gruppen konnten nicht geladen werden', error);
      setSnackbar({ open: true, message: 'Gruppen konnten nicht geladen werden.', severity: 'error' });
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadCourses = async (user: User) => {
    setLoadingCourses(true);
    try {
      const coursesSnapshot = await getDocs(collection(db, 'users', user.uid, 'courses'));
      const loadedCourses: Course[] = [];

      for (const courseDoc of coursesSnapshot.docs) {
        const courseData = courseDoc.data();

        const chaptersSnapshot = await getDocs(
          collection(db, 'users', user.uid, 'courses', courseDoc.id, 'chapters')
        );

        const publishedChapters = chaptersSnapshot.docs.filter(
          (chapterDoc) => chapterDoc.data().status === 'published'
        );

        if (publishedChapters.length === 0) {
          continue;
        }

        let publishedLessons = 0;
        for (const chapterDoc of publishedChapters) {
          const lessonsSnapshot = await getDocs(collection(chapterDoc.ref, 'lessons'));
          publishedLessons += lessonsSnapshot.docs.filter((lessonDoc) => {
            const lessonData = lessonDoc.data();
            return lessonData.status === 'published' && lessonData.type !== 'subchapter';
          }).length;
        }

        if (publishedLessons === 0) {
          continue;
        }

        loadedCourses.push({
          id: courseDoc.id,
          title: courseData.title ?? 'Unbenannter Kurs',
          description: courseData.description ?? '',
          lessons: publishedLessons,
          coverImageUrl: courseData.coverImageUrl,
          coverColor: courseData.coverColor,
          chapters: publishedChapters.length,
        });
      }

      setCourses(loadedCourses);
    } catch (error) {
      console.error('Kurse konnten nicht geladen werden', error);
      setSnackbar({ open: true, message: 'Kurse konnten nicht geladen werden.', severity: 'error' });
    } finally {
      setLoadingCourses(false);
    }
  };

  const groupLookup = useMemo(() => {
    const map = new Map<string, MemberGroup>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const baseList = term
      ? members.filter((member) =>
          member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term)
        )
      : members;

    const sortedList = [...baseList].sort((a, b) => {
      if (sortOption === 'name-asc') {
        return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
      }
      const dateA = a.createdAt ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt ? b.createdAt.getTime() : 0;
      return dateB - dateA;
    });

    return sortedList;
  }, [members, search, sortOption]);

  const handleFilterMenuClose = () => {
    setFilterAnchorEl(null);
  };

  const handleSortChange = (option: MemberSortOption) => {
    setSortOption(option);
    handleFilterMenuClose();
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setSelectedCourseIds(member.assignedCourseIds);
    setInitialCourseIds(member.assignedCourseIds);
    setSelectedGroupIds(member.groupIds);
    setSelectedRole(member.role);
  };

  const handleDrawerClose = () => {
    setSelectedMember(null);
    setSelectedCourseIds([]);
    setInitialCourseIds([]);
    setSelectedGroupIds([]);
    setSelectedRole('member');
  };

  const handleSelectGroup = (group: MemberGroup) => {
    setSelectedGroup(group);
    setSelectedGroupCourseIds(group.assignedCourseIds);
    setInitialGroupCourseIds(group.assignedCourseIds);
  };

  const handleGroupDrawerClose = () => {
    setSelectedGroup(null);
    setSelectedGroupCourseIds([]);
    setInitialGroupCourseIds([]);
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const toggleGroupCourseSelection = (courseId: string) => {
    setSelectedGroupCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSaveGroupCourses = async () => {
    if (!currentUser || !selectedGroup) return;
    const addedCourseIds = selectedGroupCourseIds.filter((id) => !initialGroupCourseIds.includes(id));
    const removedCourseIds = initialGroupCourseIds.filter((id) => !selectedGroupCourseIds.includes(id));

    setGroupDrawerSaving(true);
    try {
      const groupRef = doc(db, 'users', currentUser.uid, 'memberGroups', selectedGroup.id);
      await updateDoc(groupRef, {
        assignedCourseIds: selectedGroupCourseIds,
        updatedAt: serverTimestamp(),
      });

      setGroups((prev) =>
        prev.map((group) =>
          group.id === selectedGroup.id
            ? { ...group, assignedCourseIds: selectedGroupCourseIds }
            : group
        )
      );

      setSelectedGroup((prev) =>
        prev ? { ...prev, assignedCourseIds: selectedGroupCourseIds } : prev
      );

      // Automatically assign courses to all members in this group
      const groupMembers = members.filter((member) => member.groupIds.includes(selectedGroup.id));
      
      for (const member of groupMembers) {
        if (!member.email) continue;

        // Merge member's existing courses with new group courses
        const mergedCourseIds = Array.from(new Set([...member.assignedCourseIds, ...addedCourseIds]));
        const finalCourseIds = mergedCourseIds.filter((id) => !removedCourseIds.includes(id));

        const memberRef = doc(db, 'users', currentUser.uid, 'members', member.id);
        await updateDoc(memberRef, {
          assignedCourseIds: finalCourseIds,
          updatedAt: serverTimestamp(),
        });

        // Update local state
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id ? { ...m, assignedCourseIds: finalCourseIds } : m
          )
        );

        // Send invitations for added courses
        if (addedCourseIds.length > 0) {
          await syncCourseInvitationsForMember(member, addedCourseIds, []);
        }
        // Revoke invitations for removed courses
        if (removedCourseIds.length > 0) {
          await syncCourseInvitationsForMember(member, [], removedCourseIds);
        }
      }

      setInitialGroupCourseIds(selectedGroupCourseIds);
      setSnackbar({ open: true, message: `Kurse aktualisiert. ${groupMembers.length} Mitglied(er) wurden benachrichtigt.`, severity: 'success' });
    } catch (error) {
      console.error('Gruppenkurse konnten nicht gespeichert werden', error);
      setSnackbar({ open: true, message: 'Gruppenkurse konnten nicht gespeichert werden.', severity: 'error' });
    } finally {
      setGroupDrawerSaving(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!currentUser || !selectedMember) return;
    const addedCourseIds = selectedCourseIds.filter((id) => !initialCourseIds.includes(id));
    const removedCourseIds = initialCourseIds.filter((id) => !selectedCourseIds.includes(id));
    let nextStatus: MemberStatus = selectedMember.status ?? 'inactive';
    if (selectedCourseIds.length === 0) {
      nextStatus = 'inactive';
    } else if (addedCourseIds.length > 0 || nextStatus === 'inactive') {
      nextStatus = 'invited';
    }
    setDrawerSaving(true);
    try {
      const memberRef = doc(db, 'users', currentUser.uid, 'members', selectedMember.id);
      await updateDoc(memberRef, {
        assignedCourseIds: selectedCourseIds,
        groupIds: selectedGroupIds,
        role: selectedRole,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      setMembers((prev) =>
        prev.map((member) =>
          member.id === selectedMember.id
            ? {
                ...member,
                assignedCourseIds: selectedCourseIds,
                groupIds: selectedGroupIds,
                role: selectedRole,
                status: nextStatus,
              }
            : member
        )
      );

      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              assignedCourseIds: selectedCourseIds,
              groupIds: selectedGroupIds,
              role: selectedRole,
              status: nextStatus,
            }
          : prev
      );
      if (selectedMember.email && (addedCourseIds.length > 0 || removedCourseIds.length > 0)) {
        await syncCourseInvitationsForMember(selectedMember, addedCourseIds, removedCourseIds);
      }

      setInitialCourseIds(selectedCourseIds);

      if (!selectedMember.email && addedCourseIds.length > 0) {
        setSnackbar({
          open: true,
          message: 'Mitglied aktualisiert. Hinweis: Ohne E-Mail können keine Einladungen verschickt werden.',
          severity: 'info',
        });
      } else {
        setSnackbar({ open: true, message: 'Mitglied wurde aktualisiert.', severity: 'success' });
      }
    } catch (error) {
      console.error('Zuordnungen konnten nicht gespeichert werden', error);
      setSnackbar({ open: true, message: 'Zuordnungen konnten nicht gespeichert werden.', severity: 'error' });
    } finally {
      setDrawerSaving(false);
    }
  };

  const handleCreateMember = async () => {
    if (!currentUser) return;
    if (!newMember.name && !newMember.email) {
      setSnackbar({ open: true, message: 'Name oder E-Mail ist erforderlich.', severity: 'error' });
      return;
    }
    setAddMemberLoading(true);
    try {
      const payload = {
        name: newMember.name || newMember.email,
        email: newMember.email,
        role: newMember.role,
        status: 'inactive' as MemberStatus,
        groupIds: [],
        assignedCourseIds: [],
        loginCount: 0,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'members'), payload);
      setMembers((prev) => [
        {
          id: docRef.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          status: payload.status,
          groupIds: [],
          assignedCourseIds: [],
          loginCount: 0,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setAddMemberOpen(false);
      setNewMember({ name: '', email: '', role: 'member' });
      setSnackbar({ open: true, message: 'Mitglied eingeladen.', severity: 'success' });
    } catch (error) {
      console.error('Mitglied konnte nicht angelegt werden', error);
      setSnackbar({ open: true, message: 'Mitglied konnte nicht angelegt werden.', severity: 'error' });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!currentUser || !newGroup.name) {
      setSnackbar({ open: true, message: 'Gruppenname ist erforderlich.', severity: 'error' });
      return;
    }
    setAddGroupLoading(true);
    try {
      const payload = {
        name: newGroup.name,
        description: newGroup.description,
        assignedCourseIds: [],
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'memberGroups'), payload);
      setGroups((prev) => [
        { id: docRef.id, name: payload.name, description: payload.description, assignedCourseIds: [], createdAt: new Date() },
        ...prev,
      ]);
      setNewGroup({ name: '', description: '' });
      setAddGroupOpen(false);
      setSnackbar({ open: true, message: 'Gruppe erstellt.', severity: 'success' });
    } catch (error) {
      console.error('Gruppe konnte nicht erstellt werden', error);
      setSnackbar({ open: true, message: 'Gruppe konnte nicht erstellt werden.', severity: 'error' });
    } finally {
      setAddGroupLoading(false);
    }
  };

  const handleDeleteMemberRequest = (member: Member) => {
    setMemberToDelete(member);
  };

  const handleDeleteMemberConfirm = async () => {
    if (!currentUser || !memberToDelete) return;
    setDeleteMemberLoading(true);
    try {
      if (memberToDelete.email) {
        await revokeAllInvitationsForMember(memberToDelete);
      }

      await deleteDoc(doc(db, 'users', currentUser.uid, 'members', memberToDelete.id));
      setMembers((prev) => prev.filter((member) => member.id !== memberToDelete.id));

      if (selectedMember?.id === memberToDelete.id) {
        handleDrawerClose();
      }

      setSnackbar({ open: true, message: 'Mitglied wurde gelöscht.', severity: 'success' });
    } catch (error) {
      console.error('Mitglied konnte nicht gelöscht werden', error);
      setSnackbar({ open: true, message: 'Mitglied konnte nicht gelöscht werden.', severity: 'error' });
    } finally {
      setDeleteMemberLoading(false);
      setMemberToDelete(null);
    }
  };

  const buildInvitationId = (email: string, courseId: string, ownerId: string) =>
    `${ownerId}__${email}__${courseId}`;

  const syncCourseInvitationsForMember = async (
    member: Member,
    addedCourseIds: string[],
    removedCourseIds: string[]
  ) => {
    if (!currentUser || !member.email) return;
    const normalizedEmail = member.email.trim().toLowerCase();
    if (!normalizedEmail) return;

    const operations: Promise<unknown>[] = [];

    for (const courseId of addedCourseIds) {
      const course = courses.find((course) => course.id === courseId);
      const invitationRef = doc(
        db,
        'courseInvitations',
        buildInvitationId(normalizedEmail, courseId, currentUser.uid)
      );
      operations.push(
        setDoc(
          invitationRef,
          {
            inviteeEmail: normalizedEmail,
            memberId: member.id,
            ownerId: currentUser.uid,
            ownerEmail: currentUser.email ?? null,
            ownerName: currentUser.displayName ?? null,
            courseId,
            courseTitle: course?.title ?? 'Kurs',
            courseDescription: course?.description ?? '',
            coverImageUrl: course?.coverImageUrl ?? null,
            coverColor: course?.coverColor ?? null,
            chapterCount: course?.chapters ?? 0,
            lessonCount: course?.lessons ?? 0,
            status: 'pending',
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }

    for (const courseId of removedCourseIds) {
      const invitationRef = doc(
        db,
        'courseInvitations',
        buildInvitationId(normalizedEmail, courseId, currentUser.uid)
      );
      operations.push(
        updateDoc(invitationRef, {
          status: 'revoked',
          revokedAt: serverTimestamp(),
        }).catch(() => undefined)
      );
    }

    await Promise.all(operations);
  };

  const revokeAllInvitationsForMember = async (member: Member) => {
    if (!currentUser || !member.email) return;
    const normalizedEmail = member.email.trim().toLowerCase();
    if (!normalizedEmail || member.assignedCourseIds.length === 0) return;

    const operations = member.assignedCourseIds.map((courseId) => {
      const invitationRef = doc(
        db,
        'courseInvitations',
        buildInvitationId(normalizedEmail, courseId, currentUser.uid)
      );
      return updateDoc(invitationRef, {
        status: 'revoked',
        revokedAt: serverTimestamp(),
      }).catch(() => undefined);
    });

    await Promise.all(operations);
  };

  const handleExportCsv = () => {
    if (!filteredMembers.length) {
      setSnackbar({ open: true, message: 'Keine Mitglieder zum Exportieren.', severity: 'info' });
      return;
    }
    const header = ['Name', 'E-Mail', 'Status', 'Rolle', 'Gruppen', 'Zugeordnete Kurse'];
    const rows = filteredMembers.map((member) => [
      member.name,
      member.email,
      statusConfig[member.status].label,
      roleOptions.find((role) => role.value === member.role)?.label ?? member.role,
      member.groupIds.map((id) => groupLookup.get(id)?.name ?? '').filter(Boolean).join(' | '),
      member.assignedCourseIds.length.toString(),
    ]);
    const csv = [header, ...rows].map((line) => line.map((value) => `"${value ?? ''}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mitglieder.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmExport = () => {
    handleExportCsv();
    setConfirmExportOpen(false);
  };

  if (!currentUser) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto' }}>
        <Alert severity="info">Bitte melde dich an, um Mitglieder zu verwalten.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1160, mx: 'auto', width: '100%' }}>
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Mitglieder
        </Typography>
        <Typography color="text.secondary">
          Lade Personen ein, erstelle Gruppen und teile Kurse gezielt zu.
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_event, value) => setActiveTab(value)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={`Mitglieder (${members.length})`} />
        <Tab label={`Gruppen (${groups.length})`} />
      </Tabs>

      {activeTab === 0 && (
        <Paper sx={{ mt: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mitglied suchen"
              fullWidth
              startAdornment={
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              }
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Tooltip title="Sortieren">
                <IconButton
                  color={sortOption === 'date-desc' ? 'inherit' : 'primary'}
                  onClick={(event) => setFilterAnchorEl(event.currentTarget)}
                  aria-controls={filterAnchorEl ? 'member-filter-menu' : undefined}
                  aria-haspopup="true"
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export CSV">
                <IconButton color="inherit" onClick={() => setConfirmExportOpen(true)}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setAddMemberOpen(true)}>
                Hinzufügen
              </Button>
            </Stack>
          </Stack>
          <Menu
            id="member-filter-menu"
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={handleFilterMenuClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          >
            <MenuItem selected={sortOption === 'name-asc'} onClick={() => handleSortChange('name-asc')}>
              Name (A–Z)
            </MenuItem>
            <MenuItem selected={sortOption === 'date-desc'} onClick={() => handleSortChange('date-desc')}>
              Neueste zuerst
            </MenuItem>
          </Menu>
          <Divider sx={{ my: 3 }} />
          {loadingMembers ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : filteredMembers.length === 0 ? (
            <Alert severity="info">Keine Mitglieder vorhanden.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Gruppen</TableCell>
                  <TableCell>Zugeteilte Kurse</TableCell>
                  <TableCell>Erstellt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleSelectMember(member)}>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar>{initials(member.name)}</Avatar>
                        <Box>
                          <Typography fontWeight={600}>{member.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {member.email || 'Keine E-Mail hinterlegt'}
                          </Typography>
                          <Chip size="small" label={roleOptions.find((role) => role.value === member.role)?.label} sx={{ mt: 0.5 }} />
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={statusConfig[member.status].color} label={statusConfig[member.status].label} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {member.groupIds.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Keine Gruppen
                          </Typography>
                        )}
                        {member.groupIds.map((groupId) => (
                          <Chip
                            key={groupId}
                            label={groupLookup.get(groupId)?.name ?? 'Unbekannt'}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SchoolIcon fontSize="small" color="primary" />
                        <Typography variant="body2">{member.assignedCourseIds.length} Kurs(e)</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(member.createdAt)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ mt: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Gruppenübersicht
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Segmentiere Mitglieder nach Team, Kunde oder Lernpfad.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<GroupsIcon />} onClick={() => setAddGroupOpen(true)}>
              Gruppe anlegen
            </Button>
          </Stack>
          <Divider sx={{ my: 3 }} />
          {loadingGroups ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : groups.length === 0 ? (
            <Alert severity="info">Noch keine Gruppen erstellt.</Alert>
          ) : (
            <Stack spacing={2}>
              {groups.map((group) => {
                const membersInGroup = members.filter((member) => member.groupIds.includes(group.id));
                return (
                  <Paper 
                    key={group.id} 
                    variant="outlined" 
                    sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                      <Box>
                        <Typography fontWeight={600}>{group.name}</Typography>
                        {group.description && (
                          <Typography variant="body2" color="text.secondary">{group.description}</Typography>
                        )}
                        <Stack direction="row" spacing={2} mt={1}>
                          <Chip 
                            icon={<GroupsIcon fontSize="small" />}
                            label={`${membersInGroup.length} Mitglied${membersInGroup.length !== 1 ? 'er' : ''}`} 
                            size="small" 
                            variant="outlined"
                          />
                          <Chip 
                            icon={<SchoolIcon fontSize="small" />}
                            label={`${group.assignedCourseIds.length} Kurs${group.assignedCourseIds.length !== 1 ? 'e' : ''}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Mitglied hinzufügen</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name"
              value={newMember.name}
              onChange={(event) => setNewMember((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="z. B. PlanVision 3D"
              fullWidth
            />
            <TextField
              label="E-Mail"
              type="email"
              value={newMember.email}
              onChange={(event) => setNewMember((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="kontakt@example.com"
              fullWidth
            />
            <TextField
              label="Rolle"
              select
              value={newMember.role}
              onChange={(event) => setNewMember((prev) => ({ ...prev, role: event.target.value as MemberRole }))}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Abbrechen</Button>
          <Button onClick={handleCreateMember} variant="contained" disabled={addMemberLoading}>
            {addMemberLoading ? 'Speichert...' : 'Einladen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addGroupOpen} onClose={() => setAddGroupOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Neue Gruppe</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name der Gruppe"
              value={newGroup.name}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="z. B. Kunden A"
              required
              fullWidth
            />
            <TextField
              label="Beschreibung"
              value={newGroup.description}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional"
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddGroupOpen(false)}>Abbrechen</Button>
          <Button onClick={handleCreateGroup} variant="contained" disabled={addGroupLoading}>
            {addGroupLoading ? 'Speichert...' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(memberToDelete)} onClose={() => setMemberToDelete(null)}>
        <DialogTitle>Mitglied löschen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchtest du {memberToDelete?.name || 'dieses Mitglied'} dauerhaft entfernen? Bestehende Gruppenzuordnungen
            und Einladungen werden zurückgezogen.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberToDelete(null)}>Abbrechen</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteMemberConfirm}
            disabled={deleteMemberLoading}
          >
            {deleteMemberLoading ? 'Löscht...' : 'Löschen'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmExportOpen} onClose={() => setConfirmExportOpen(false)}>
        <DialogTitle>Export bestätigen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchtest du die aktuelle Mitgliederliste als CSV exportieren? Eventuelle Filter oder Suchbegriffe werden
            übernommen.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmExportOpen(false)}>Abbrechen</Button>
          <Button onClick={handleConfirmExport} variant="contained">
            Export starten
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={Boolean(selectedMember)} onClose={handleDrawerClose} sx={{ '& .MuiDrawer-paper': { width: { xs: 360, sm: 420 }, p: 3 } }}>
        {selectedMember && (
          <Stack spacing={3} height="100%">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                {selectedMember.name}
              </Typography>
              <IconButton onClick={handleDrawerClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {selectedMember.email || 'Keine E-Mail hinterlegt'}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <Chip size="small" color={statusConfig[selectedMember.status].color} label={statusConfig[selectedMember.status].label} />
                <Chip size="small" label={roleOptions.find((role) => role.value === selectedRole)?.label} />
              </Stack>
            </Box>
            <TextField
              label="Rolle"
              select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as MemberRole)}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              multiple
              options={groups}
              value={groups.filter((group) => selectedGroupIds.includes(group.id))}
              getOptionLabel={(option) => option.name}
              onChange={(_event, values) => setSelectedGroupIds(values.map((group) => group.id))}
              renderInput={(params) => <TextField {...params} label="Gruppen" placeholder="Gruppe wählen" />}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Kurse einladen
              </Typography>
              {loadingCourses ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : courses.length === 0 ? (
                <Alert severity="info">Noch keine veröffentlichten Kurse.</Alert>
              ) : (
                <List sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {courses.map((course) => (
                    <ListItem key={course.id} disableGutters>
                      <ListItemAvatar>
                        <Avatar>
                          <SchoolIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={course.title}
                        secondary={`${course.lessons ?? 0} Lektionen`}
                      />
                      <Chip
                        label={selectedCourseIds.includes(course.id) ? 'Zugeordnet' : 'Verfügbar'}
                        color={selectedCourseIds.includes(course.id) ? 'primary' : 'default'}
                        size="small"
                        onClick={() => toggleCourseSelection(course.id)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            <Box sx={{ mt: 'auto' }}>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
                <Tooltip title="Mitglied löschen">
                  <span>
                    <IconButton
                      color="error"
                      onClick={() => selectedMember && handleDeleteMemberRequest(selectedMember)}
                      disabled={deleteMemberLoading}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={drawerSaving ? 'Speichert...' : 'Änderungen speichern'}>
                  <span>
                    <IconButton color="primary" onClick={handleSaveAssignments} disabled={drawerSaving}>
                      {drawerSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          </Stack>
        )}
      </Drawer>

      <Drawer anchor="right" open={Boolean(selectedGroup)} onClose={handleGroupDrawerClose} sx={{ '& .MuiDrawer-paper': { width: { xs: 360, sm: 420 }, p: 3 } }}>
        {selectedGroup && (
          <Stack spacing={3} height="100%">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                {selectedGroup.name}
              </Typography>
              <IconButton onClick={handleGroupDrawerClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box>
              {selectedGroup.description && (
                <Typography variant="body2" color="text.secondary">
                  {selectedGroup.description}
                </Typography>
              )}
              <Stack direction="row" spacing={1} mt={1.5}>
                <Chip 
                  icon={<GroupsIcon fontSize="small" />}
                  label={`${members.filter((m) => m.groupIds.includes(selectedGroup.id)).length} Mitglied(er)`} 
                  size="small" 
                  color="primary"
                />
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Mitglieder in dieser Gruppe
              </Typography>
              {members.filter((m) => m.groupIds.includes(selectedGroup.id)).length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>Noch keine Mitglieder zugeordnet.</Alert>
              ) : (
                <List sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  {members.filter((m) => m.groupIds.includes(selectedGroup.id)).map((member) => (
                    <ListItem key={member.id} disableGutters sx={{ px: 2 }}>
                      <ListItemAvatar>
                        <Avatar>{initials(member.name)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={member.name}
                        secondary={member.email || 'Keine E-Mail'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Kurse für diese Gruppe
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Alle Mitglieder der Gruppe erhalten automatisch Einladungen zu den zugeordneten Kursen.
              </Typography>
              {loadingCourses ? (
                <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </Stack>
              ) : courses.length === 0 ? (
                <Alert severity="info">Noch keine veröffentlichten Kurse.</Alert>
              ) : (
                <List sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {courses.map((course) => (
                    <ListItem key={course.id} disableGutters>
                      <ListItemAvatar>
                        <Avatar>
                          <SchoolIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={course.title}
                        secondary={`${course.lessons ?? 0} Lektionen`}
                      />
                      <Chip
                        label={selectedGroupCourseIds.includes(course.id) ? 'Zugeordnet' : 'Verfügbar'}
                        color={selectedGroupCourseIds.includes(course.id) ? 'primary' : 'default'}
                        size="small"
                        onClick={() => toggleGroupCourseSelection(course.id)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            <Box sx={{ mt: 'auto' }}>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center">
                <Tooltip title={groupDrawerSaving ? 'Speichert...' : 'Kurse speichern & Mitglieder einladen'}>
                  <span>
                    <IconButton color="primary" onClick={handleSaveGroupCourses} disabled={groupDrawerSaving}>
                      {groupDrawerSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          </Stack>
        )}
      </Drawer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
