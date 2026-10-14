import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query. Used where a value must be passed as a prop
 *  (for example PixelSwap's aspectRatio) and therefore cannot be a CSS rule. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = event => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
