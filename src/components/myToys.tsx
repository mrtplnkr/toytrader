import { collection, 
    getDocs, deleteDoc,
    doc, 
    query,
    where} from "firebase/firestore";
  import { getDownloadURL, ref } from "firebase/storage";
  import { useState } from "react";
  import { useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import { auth, db, storage } from "../firebase-config";
  import Item from "./item";
  
  interface Toy {
    title: string;
    id: string;
    file: string;
    userId: string;
  }
  
  function MyToysPage() {
    let navigate = useNavigate();
  
    const [toyList, setToyList] = useState<Array<Toy>>([]);
  
    const toysCollectionRef = collection(db, "toys");
  
    useEffect(() => {
      getToyList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (toyList.length > 0) localStorage.setItem('myToys', toyList.length.toString())
    }, [toyList.length])
  
    const [myWishedItems, setMyWishedItems] = useState<any[]>([]);
  
    const addRemoveWish = (newItem: any) => {
        if (myWishedItems && myWishedItems.filter(x => x.id === newItem.id).length) {
          setMyWishedItems(myWishedItems.filter(x => x.id !== newItem.id));
        } else {
          setMyWishedItems(myWishedItems.concat([newItem]));
        }
    }
  
    const deleteItem = async (id: string) => {
      const movieDoc = doc(db, "toys", id);
      await deleteDoc(movieDoc);
      getToyList();
    };
    
    const getToyList = async () => {
      try {
        setToyList([]);
        const q = query(toysCollectionRef, where("userId", "==", auth?.currentUser?.uid))
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (doc) => {
              const d = doc.data();
              const filesFolderRef = ref(storage, `projectFiles/${d.file}`);
              const url = await getDownloadURL(filesFolderRef);

              setToyList(a => [...a, {
                  id: doc.id,
                  userId: d.userId,
                  title: d.title,
                  file: url,
              }]);
          });
      } catch (err) {
        console.error(err);
      }
    };
  
    return (
      <>
        <h3>All other toys in your area</h3>
  
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button style={{alignSelf: 'flex-end'}} onClick={() => navigate('/addNew')}>add your toy</button>
          <button style={{alignSelf: 'flex-start'}} onClick={() => getToyList()}>refresh</button>
        </div>
  
        <ul id="toyList">
          {toyList.length > 0 ? toyList.map((x) => {
            return (
              <Item key={x.id} {...x} deleteItem={deleteItem} addRemoveWish={addRemoveWish} />
            )
          }) : <div>you haven't added anything yet</div>}
        </ul>
      </>
    );
  }
  
  export default MyToysPage;