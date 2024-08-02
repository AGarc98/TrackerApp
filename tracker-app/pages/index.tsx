import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import InventoryItemComponent from '../components/InventoryItem';
import { InventoryItem } from '../types/inventoryItem';
import AddItemForm from '../components/AddItemForm';
import "../styles/globals.css";

const Home: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchItems = async () => {
    const querySnapshot = await getDocs(collection(db, 'inventory'));
    const itemsData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InventoryItem[];
    setItems(itemsData);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Inventory Items</h1>
      <AddItemForm onAdd={fetchItems} />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search items..."
        className="mt-2 mb-4 p-2 border rounded w-full"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <InventoryItemComponent key={item.id} item={item} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
};

export default Home;
