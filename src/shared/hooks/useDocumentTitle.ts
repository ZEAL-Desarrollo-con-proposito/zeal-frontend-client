import { useEffect } from 'react';

export const DEFAULT_DOCUMENT_TITLE = 'ZEAL — Cuidado de la salud mental en el trabajo';

/** El título de la pestaña dice dónde está la persona (útil con varias pestañas y lectores de pantalla). */
export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = `${pageTitle} · ZEAL`;
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [pageTitle]);
}
