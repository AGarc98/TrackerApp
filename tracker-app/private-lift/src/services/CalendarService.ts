import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

const APP_CALENDAR_TITLE = 'PrivateLift';

export const requestCalendarPermissions = async (): Promise<boolean> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
};

const getOrCreateAppCalendar = async (): Promise<string | null> => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(c => c.title === APP_CALENDAR_TITLE);
  if (existing) return existing.id;

  if (Platform.OS === 'ios') {
    try {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      return await Calendar.createCalendarAsync({
        title: APP_CALENDAR_TITLE,
        color: '#8B5CF6',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultCal.source?.id,
        source: defaultCal.source,
        name: APP_CALENDAR_TITLE,
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    } catch (e) {
      console.error('Failed to create PrivateLift calendar:', e);
    }
  }

  // Android fallback: use any writable calendar
  return calendars.find(c => c.allowsModifications)?.id ?? null;
};

export const addWorkoutEvent = async (params: {
  workoutName: string;
  startTime: number;
  endTime: number;
  rpe?: number | null;
}): Promise<void> => {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'granted') return;

    const calendarId = await getOrCreateAppCalendar();
    if (!calendarId) return;

    const { workoutName, startTime, endTime, rpe } = params;
    const notes = rpe != null ? `RPE: ${rpe}/10` : undefined;

    await Calendar.createEventAsync(calendarId, {
      title: workoutName,
      startDate: new Date(startTime),
      endDate: new Date(endTime),
      notes,
      alarms: [],
    });
  } catch (e) {
    console.error('Failed to add workout to calendar:', e);
  }
};
