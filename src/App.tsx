// src/App.tsx

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, Timestamp } from "firebase/firestore";

// --- React Imports ---
import React, { useState, useEffect, useRef } from 'react';

// --- 类型定义 ---
interface Equipment {
  id: string;
  name: string;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Booking {
  id: string;
  equipmentId: string;
  equipmentName: string;
  userId: string;
  userDisplayName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'booked' | 'cancelled';
  bookedAt: Timestamp;
  cancelledAt?: Timestamp;
}

// --- Firebase Configuration (using environment variables) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
};

// Custom Calendar Component that uses the global FullCalendar object
declare global {
  interface Window {
    FullCalendar: any;
  }
}

interface CalendarComponentProps {
  events: {
    title: string;
    start: Date;
    end: Date;
  }[];
}

function CalendarComponent({ events }: CalendarComponentProps) {
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (calendarRef.current && window.FullCalendar) {
            const calendar = new window.FullCalendar.Calendar(calendarRef.current, {
                initialView: 'dayGridMonth',
                height: 'auto',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                },
                slotMinTime: '08:00:00',
                slotMaxTime: '17:00:00',
                events: events,
                eventClick: (info: any) => {
                    const { title, start, end } = info.event;
                    alert(`Booking Details:\n- Event: ${title}\n- From: ${start.toLocaleString()}\n- To: ${end ? end.toLocaleString() : 'N/A'}`);
                }
            });
            calendar.render();
            return () => calendar.destroy();
        }
    }, [events]);

    return <div ref={calendarRef}></div>;
}

// Main App component
export default function App() {
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userPhotoURL, setUserPhotoURL] = useState<string>('');
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [allPublicBookings, setAllPublicBookings] = useState<Booking[]>([]);
  
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [bookingForm, setBookingForm] = useState({ startDate: '', startTime: '08:00', endDate: '', endTime: '08:30' });
  const [message, setMessage] = useState<string>('');
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState<boolean>(false);
  const [showEditEquipmentModal, setShowEditEquipmentModal] = useState<boolean>(false);
  const [showDeleteEquipmentModal, setShowDeleteEquipmentModal] = useState<boolean>(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState({ name: '', description: '' });

  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  
  const appId = firebaseConfig.appId;

  // --- Effects ---
  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      console.error("Firebase configuration is incomplete. Please check your .env file or GitHub Secrets.");
      setIsAuthReady(true);
      return;
    }

    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const firebaseAuth = getAuth(app);
    setDb(firestore);
    setAuth(firebaseAuth);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setUserId(user ? user.uid : null);
      setUserDisplayName(user ? user.displayName || 'User' : '');
      setUserPhotoURL(user ? user.photoURL || '' : '');
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;
      
      if (modifierKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (isAdmin) {
          setShowAdminPanel(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!db || !appId) return;
    const unsubEquipment = onSnapshot(collection(db, `artifacts/${appId}/public/data/equipment`), (snapshot) => {
      setEquipmentList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Equipment, 'id'> })));
    });
    const unsubBookings = onSnapshot(collection(db, `artifacts/${appId}/public/data/bookings`), (snapshot) => {
      setAllPublicBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Booking, 'id'> })));
    });
    return () => { unsubEquipment(); unsubBookings(); };
  }, [db, appId]);

  useEffect(() => {
    if (!db || !userId || !appId) { setMyBookings([]); return; }
    const unsub = onSnapshot(collection(db, `artifacts/${appId}/users/${userId}/bookings`), (snapshot) => {
      setMyBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Omit<Booking, 'id'> })).sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis()));
    });
    return () => unsub();
  }, [db, userId, appId]);

  // --- Functions ---
  const handleBookingFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setBookingForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const openBookingModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    const today = new Date().toISOString().split('T')[0];
    setBookingForm({ startDate: today, startTime: '08:00', endDate: today, endTime: '08:30' });
    setShowBookingModal(true);
  };
  const closeBookingModal = () => { setShowBookingModal(false); setMessage(''); };
  const openCancelModal = (booking: Booking) => { setBookingToCancel(booking); setShowCancelModal(true); };
  const closeCancelModal = () => { setShowCancelModal(false); setMessage(''); };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !db || !userId) return;
    const { startDate, startTime, endDate, endTime } = bookingForm;
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    if (startDateTime >= endDateTime) {
      setMessage("End time must be after start time."); return;
    }
    const now = new Date();
    if (startDateTime.getTime() < now.getTime()) {
        setMessage("Booking start time cannot be in the past.");
        return;
    }

    const q = query(collection(db, `artifacts/${appId}/public/data/bookings`), where('equipmentId', '==', selectedEquipment.id), where('status', '==', 'booked'));
    const snapshot = await getDocs(q);
    const isBooked = snapshot.docs.some(d => startDateTime < d.data().endDate.toDate() && endDateTime > d.data().startDate.toDate());
    if (isBooked) {
      setMessage("This equipment is already booked for this time slot."); return;
    }
    const bookingData: Omit<Booking, 'id'> = {
      equipmentId: selectedEquipment.id,
      equipmentName: selectedEquipment.name,
      userId,
      userDisplayName,
      startDate: Timestamp.fromDate(startDateTime),
      endDate: Timestamp.fromDate(endDateTime),
      status: 'booked',
      bookedAt: Timestamp.now()
    };
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/bookings`), bookingData);
    await addDoc(collection(db, `artifacts/${appId}/public/data/bookings`), bookingData);
    closeBookingModal();
  };

  const cancelBooking = async () => {
    if (!bookingToCancel || !db || !userId) return;
    const q = query(collection(db, `artifacts/${appId}/public/data/bookings`), where('equipmentId', '==', bookingToCancel.equipmentId), where('userId', '==', userId), where('bookedAt', '==', bookingToCancel.bookedAt));
    const snapshot = await getDocs(q);
    snapshot.forEach(d => updateDoc(d.ref, { status: 'cancelled', cancelledAt: Timestamp.now() }));
    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/bookings`, bookingToCancel.id), { status: 'cancelled', cancelledAt: Timestamp.now() });
    closeCancelModal();
  };

  const handleEquipmentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEquipmentForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const openAddEquipmentModal = () => { setEquipmentForm({ name: '', description: '' }); setShowAddEquipmentModal(true); }
  const addEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !isAdmin || !equipmentForm.name || !equipmentForm.description) {
      setMessage("Please fill out all fields."); return;
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/equipment`), { ...equipmentForm, createdAt: Timestamp.now() });
      setShowAddEquipmentModal(false);
      setMessage('');
    } catch (error: any) {
      setMessage(`Failed to add equipment. Error: ${error.message}`);
    }
  };
  const openEditEquipmentModal = (equipment: Equipment) => { setEquipmentToEdit(equipment); setEquipmentForm({ name: equipment.name, description: equipment.description }); setShowEditEquipmentModal(true); };
  const closeEditEquipmentModal = () => { setShowEditEquipmentModal(false); setEquipmentToEdit(null); setMessage(''); };
  const updateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !isAdmin || !equipmentToEdit) return;
    try {
      const equipmentRef = doc(db, `artifacts/${appId}/public/data/equipment`, equipmentToEdit.id);
      await updateDoc(equipmentRef, { ...equipmentForm, updatedAt: Timestamp.now() });
      closeEditEquipmentModal();
    } catch (error: any) {
       setMessage(`Failed to update equipment. Error: ${error.message}`);
    }
  };
  const openDeleteEquipmentModal = (equipment: Equipment) => { setEquipmentToDelete(equipment); setShowDeleteEquipmentModal(true); };
  const closeDeleteEquipmentModal = () => { setShowDeleteEquipmentModal(false); setEquipmentToDelete(null); setMessage(''); };
  const deleteEquipment = async () => {
    if (!db || !isAdmin || !equipmentToDelete) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/equipment`, equipmentToDelete.id));
      closeDeleteEquipmentModal();
    } catch (error: any) {
       setMessage(`Failed to delete equipment. Error: ${error.message}`);
    }
  };

  const signInWithGoogle = async () => { if (!auth) return; await signInWithPopup(auth, new GoogleAuthProvider()); };
  const handleSignOut = async () => { if (!auth) return; await signOut(auth); };
  
  const formatDateTime = (ts: Timestamp | undefined) => {
    if (!ts) return 'N/A';
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    return ts.toDate().toLocaleString('en-US', options);
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 17; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 17) {
        slots.push(`${String(hour).padStart(2, '0')}:30`);
      }
    }
    return slots;
  };
  const timeSlots = generateTimeSlots();

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading Platform...</p></div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-xl p-8 sm:p-10">
      <header className="flex justify-between items-center mb-12 pb-6 border-b border-gray-200">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">SEG CMF Lab Equipment Management Platform</h1>
        <div ref={userMenuRef} className="relative">
            {userId ? (
                <div>
                    <button onClick={() => setShowUserMenu(prev => !prev)} className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-indigo-500 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <img src={userPhotoURL || 'https://placehold.co/40x40/E2E8F0/4A5568?text=User'} alt="User Profile" className="w-full h-full object-cover" />
                    </button>
                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 ring-1 ring-black ring-opacity-5">
                            <div className="px-4 py-3">
                                <p className="text-sm text-gray-500">Signed in as</p>
                                <p className="text-sm font-medium text-gray-900 truncate">{userDisplayName}</p>
                            </div>
                            <div className="border-t border-gray-100"></div>
                            <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <button onClick={signInWithGoogle} className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Sign In</button>
            )}
        </div>
      </header>
      <main>
        {isAdmin && (
            <section className="mb-20">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Equipment Dashboard</h2>
              <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
                <CalendarComponent
                  events={allPublicBookings
                    .filter(b => b.status === 'booked')
                    .map(b => ({
                      title: `${b.equipmentName} (${b.userDisplayName})`,
                      start: b.startDate.toDate(),
                      end: b.endDate.toDate(),
                    }))
                  }
                />
              </div>
            </section>
        )}
        
        {isAdmin && showAdminPanel && (
            <section className="mb-20">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-900">Manage Equipment</h2>
                    <button onClick={openAddEquipmentModal} className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Add Equipment</button>
                </div>
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {equipmentList.map(equipment => (
                                <tr key={equipment.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                    <td className="py-4 px-6 font-medium">{equipment.name}</td>
                                    <td className="py-4 px-6 text-gray-600">{equipment.description}</td>
                                    <td className="py-4 px-6 flex items-center gap-4">
                                        <button onClick={() => openEditEquipmentModal(equipment)} className="text-sm font-medium text-blue-600 hover:text-blue-800">Edit</button>
                                        <button onClick={() => openDeleteEquipmentModal(equipment)} className="text-sm font-medium text-red-600 hover:text-red-800">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        )}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Available Equipment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {equipmentList.map(equipment => (
              <div key={equipment.id} className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
                <h3 className="text-lg font-semibold text-indigo-700">{equipment.name}</h3>
                <p className="text-gray-600 text-sm my-2 flex-grow">{equipment.description}</p>
                <button onClick={() => openBookingModal(equipment)} className="w-full bg-indigo-600 text-white py-2 mt-4 rounded-md font-semibold hover:bg-indigo-700">Book Now</button>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-6">My Bookings</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</th>
                  <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                  <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                  <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myBookings.map(booking => (
                  <tr key={booking.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium">{booking.equipmentName}</td>
                    <td className="py-4 px-6">{formatDateTime(booking.startDate)}</td>
                    <td className="py-4 px-6">{formatDateTime(booking.endDate)}</td>
                    <td className="py-4 px-6"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${booking.status === 'booked' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{booking.status}</span></td>
                    <td className="py-4 px-6">{booking.status === 'booked' && (<button onClick={() => openCancelModal(booking)} className="text-red-600 hover:underline text-sm">Cancel</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* --- Modals --- */}
      {showBookingModal && selectedEquipment && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Book "{selectedEquipment.name}"</h2>
            <form onSubmit={submitBooking}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                  <input type="date" id="startDate" name="startDate" value={bookingForm.startDate} onChange={handleBookingFormChange} className="w-full px-3 py-2 bg-gray-100 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required/>
                </div>
                <div>
                  <label htmlFor="startTime" className="block text-sm font-semibold text-gray-700 mb-1">Start Time</label>
                  <select id="startTime" name="startTime" value={bookingForm.startTime} onChange={handleBookingFormChange} className="w-full px-3 py-2 bg-gray-100 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                    {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                  <input type="date" id="endDate" name="endDate" value={bookingForm.endDate} onChange={handleBookingFormChange} className="w-full px-3 py-2 bg-gray-100 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required/>
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-sm font-semibold text-gray-700 mb-1">End Time</label>
                  <select id="endTime" name="endTime" value={bookingForm.endTime} onChange={handleBookingFormChange} className="w-full px-3 py-2 bg-gray-100 border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" required>
                     {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>
              {message && (<div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm">{message}</div>)}
              <div className="flex justify-end space-x-4 mt-8">
                <button type="button" onClick={closeBookingModal} className="px-6 py-2 text-sm font-semibold bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-6 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {isAdmin && showAddEquipmentModal && (<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"><h2 className="text-2xl font-bold mb-4 text-center">Add New Equipment</h2><form onSubmit={addEquipment}><div className="mb-4"><label htmlFor="newName" className="block font-semibold mb-2">Name</label><input type="text" id="newName" name="name" value={equipmentForm.name} onChange={handleEquipmentFormChange} className="w-full px-3 py-2 border rounded" required/></div><div className="mb-4"><label htmlFor="newDescription" className="block font-semibold mb-2">Description</label><textarea id="newDescription" name="description" value={equipmentForm.description} onChange={handleEquipmentFormChange} className="w-full px-3 py-2 border rounded" rows={3} required></textarea></div>{message && (<div className="bg-red-100 border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">{message}</div>)}<div className="flex justify-end space-x-3"><button type="button" onClick={() => { setShowAddEquipmentModal(false); setMessage(''); }} className="bg-gray-300 py-2 px-4 rounded-md font-semibold hover:bg-gray-400">Cancel</button><button type="submit" className="bg-purple-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-purple-700">Add Equipment</button></div></form></div></div>)}
      
      {isAdmin && showEditEquipmentModal && (<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"><h2 className="text-2xl font-bold mb-4 text-center">Edit Equipment</h2><form onSubmit={updateEquipment}><div className="mb-4"><label htmlFor="editName" className="block font-semibold mb-2">Name</label><input type="text" id="editName" name="name" value={equipmentForm.name} onChange={handleEquipmentFormChange} className="w-full px-3 py-2 border rounded" required/></div><div className="mb-4"><label htmlFor="editDescription" className="block font-semibold mb-2">Description</label><textarea id="editDescription" name="description" value={equipmentForm.description} onChange={handleEquipmentFormChange} className="w-full px-3 py-2 border rounded" rows={3} required></textarea></div>{message && (<div className="bg-red-100 border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">{message}</div>)}<div className="flex justify-end space-x-3"><button type="button" onClick={closeEditEquipmentModal} className="bg-gray-300 py-2 px-4 rounded-md font-semibold hover:bg-gray-400">Cancel</button><button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-blue-700">Save Changes</button></div></form></div></div>)}

      {isAdmin && showDeleteEquipmentModal && (<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"><h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">Confirm Deletion</h2><p className="text-gray-700 mb-6 text-center">Are you sure you want to delete <span className="font-semibold">"{equipmentToDelete?.name}"</span>? This cannot be undone.</p>{message && (<div className="bg-red-100 border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">{message}</div>)}<div className="flex justify-end space-x-3"><button type="button" onClick={closeDeleteEquipmentModal} className="bg-gray-300 text-gray-800 py-2 px-4 rounded-md font-semibold hover:bg-gray-400">Cancel</button><button type="button" onClick={deleteEquipment} className="bg-red-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-red-700">Delete Equipment</button></div></div></div>)}

      {showCancelModal && (<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6"><h2 className="text-2xl font-bold mb-4 text-center">Confirm Cancellation</h2><p className="mb-6 text-center">Cancel booking for <span className="font-semibold">"{bookingToCancel?.equipmentName}"</span>?</p><div className="flex justify-end space-x-3"><button type="button" onClick={closeCancelModal} className="bg-gray-300 py-2 px-4 rounded-md font-semibold hover:bg-gray-400">No</button><button type="button" onClick={cancelBooking} className="bg-red-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-red-700">Yes, Cancel</button></div></div></div>)}
    </div>
  );
}