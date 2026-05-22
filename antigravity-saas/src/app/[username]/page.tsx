import type { Metadata, ResolvingMetadata } from 'next';
import StoreClient from './StoreClient';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Props = {
  params: { username: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const username = params.username.toLowerCase();

  try {
    const usernameRef = doc(db, 'usernames', username);
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) {
      return { title: 'Tienda no encontrada | VinylStock' };
    }

    const uid = usernameSnap.data().uid;
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { title: 'Perfil no disponible | VinylStock' };
    }

    const userData = userSnap.data();

    if (userData.isPublicStore === false) {
      return { title: 'Tienda Privada | VinylStock' };
    }

    const storeName = userData.storeName || `@${userData.username}`;
    const description = userData.storeBio || `Explora el catálogo de vinilos de ${storeName} en VinylStock.`;
    const images = userData.avatar ? [userData.avatar] : [];

    return {
      title: `${storeName} | VinylStock`,
      description,
      openGraph: {
        title: `${storeName} | VinylStock`,
        description,
        images,
        type: 'website',
      },
    };
  } catch (error) {
    return { title: 'VinylStock' };
  }
}

export default function StorePage({ params }: Props) {
  return <StoreClient username={params.username} />;
}
