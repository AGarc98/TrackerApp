// components/AddItemForm.tsx
import { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AddItemForm: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsRef = collection(db, 'inventory');
    const q = query(itemsRef, where('name', '==', name), where('description', '==', description));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Item exists, update the quantity
      const itemDoc = querySnapshot.docs[0];
      const newQuantity = itemDoc.data().quantity + quantity;
      await updateDoc(doc(db, 'inventory', itemDoc.id), { quantity: newQuantity });
    } else {
      // Item does not exist, add a new item
      const newItem = { name, quantity, description };
      await addDoc(collection(db, 'inventory'), newItem);
    }

    setName('');
    setQuantity(0);
    setDescription('');
    onAdd();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700">Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
        Add Item
      </button>
    </form>
  );
};

export default AddItemForm;
