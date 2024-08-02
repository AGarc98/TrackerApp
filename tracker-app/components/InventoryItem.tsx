// components/InventoryItem.tsx
import { InventoryItem } from '../types/inventoryItem';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useState } from 'react';

const InventoryItemComponent: React.FC<{ item: InventoryItem, onDelete: (id: string) => void }> = ({ item, onDelete }) => {
  const [quantity, setQuantity] = useState(item.quantity);

  const updateQuantity = async (newQuantity: number) => {
    const itemRef = doc(db, 'inventory', item.id);
    await updateDoc(itemRef, {
      quantity: newQuantity,
    });
    setQuantity(newQuantity);
  };

  const handleAdd = () => updateQuantity(quantity + 1);
  const handleSubtract = async () => {
    if (quantity <= 1) {
      await handleDelete();
    } else {
      updateQuantity(quantity - 1);
    }
  };

  const handleDelete = async () => {
    const itemRef = doc(db, 'inventory', item.id);
    await deleteDoc(itemRef);
    onDelete(item.id);
  };

  return (
    <div className="p-4 border rounded shadow">
      <h2 className="text-lg font-bold">{item.name}</h2>
      <p>Quantity: {quantity}</p>
      {item.description && <p>{item.description}</p>}
      <div className="mt-2">
        <button
          onClick={handleSubtract}
          className="px-2 py-1 bg-red-500 text-white rounded mr-2"
          disabled={quantity <= 0}
        >
          -
        </button>
        <button
          onClick={handleAdd}
          className="px-2 py-1 bg-green-500 text-white rounded mr-2"
        >
          +
        </button>
        <button
          onClick={handleDelete}
          className="px-2 py-1 bg-red-700 text-white rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default InventoryItemComponent;
