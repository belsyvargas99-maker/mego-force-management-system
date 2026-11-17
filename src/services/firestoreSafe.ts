/**
 * Versiones de setDoc / addDoc / updateDoc / writeBatch / runTransaction que limpian los
 * valores `undefined` antes de escribir. Usar SIEMPRE estas en lugar de las del SDK.
 */
import {
  addDoc as sdkAddDoc,
  runTransaction as sdkRunTransaction,
  setDoc as sdkSetDoc,
  updateDoc as sdkUpdateDoc,
  writeBatch as sdkWriteBatch,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
  type SetOptions,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore';
import { stripUndefined } from '../utils/stripUndefined';

type Data = Record<string, any>;

export function setDoc(ref: DocumentReference<any, any>, data: Data, options?: SetOptions) {
  const clean = stripUndefined(data);
  return options ? sdkSetDoc(ref, clean, options) : sdkSetDoc(ref, clean);
}

export function addDoc(ref: CollectionReference<any, any>, data: Data) {
  return sdkAddDoc(ref, stripUndefined(data));
}

export function updateDoc(ref: DocumentReference<any, any>, data: Data) {
  return sdkUpdateDoc(ref, stripUndefined(data));
}

export function writeBatch(db: Firestore): WriteBatch {
  const batch = sdkWriteBatch(db);
  const wrapped = {
    set(ref: DocumentReference<any, any>, data: Data, options?: SetOptions) {
      const clean = stripUndefined(data);
      if (options) batch.set(ref, clean, options);
      else batch.set(ref, clean);
      return wrapped;
    },
    update(ref: DocumentReference<any, any>, ...args: any[]) {
      // Solo se limpia la forma update(ref, objeto); la de campo/valor se deja tal cual.
      const [first, ...rest] = args;
      if (args.length === 1 && first && typeof first === 'object') {
        batch.update(ref, stripUndefined(first));
      } else {
        (batch.update as any)(ref, first, ...rest);
      }
      return wrapped;
    },
    delete(ref: DocumentReference<any, any>) {
      batch.delete(ref);
      return wrapped;
    },
    commit() {
      return batch.commit();
    },
  };
  return wrapped as unknown as WriteBatch;
}

export function runTransaction<T>(
  db: Firestore,
  updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
  return sdkRunTransaction(db, (tx) => {
    const wrapped = {
      get: (ref: DocumentReference<any, any>) => tx.get(ref),
      set(ref: DocumentReference<any, any>, data: Data, options?: SetOptions) {
        const clean = stripUndefined(data);
        if (options) tx.set(ref, clean, options);
        else tx.set(ref, clean);
        return wrapped;
      },
      update(ref: DocumentReference<any, any>, ...args: any[]) {
        const [first, ...rest] = args;
        if (args.length === 1 && first && typeof first === 'object') {
          tx.update(ref, stripUndefined(first));
        } else {
          (tx.update as any)(ref, first, ...rest);
        }
        return wrapped;
      },
      delete(ref: DocumentReference<any, any>) {
        tx.delete(ref);
        return wrapped;
      },
    };
    return updateFunction(wrapped as unknown as Transaction);
  });
}
