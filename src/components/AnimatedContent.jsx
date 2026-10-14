import { Children, cloneElement, isValidElement } from 'react';
import AnimatedText from './AnimatedText';

function animateTextNodes(nodes, settings) {
  return Children.map(nodes, node => {
    if (typeof node === 'string') {
      return node.trim()
        ? <AnimatedText label={node} {...settings} />
        : node;
    }

    if (typeof node === 'number') {
      return <AnimatedText label={String(node)} {...settings} />;
    }

    if (!isValidElement(node)) return node;
    if (node.props['data-no-text-animation'] || node.props['aria-hidden'] === true || node.props['aria-hidden'] === 'true') {
      return node;
    }

    if (node.props.children == null) return node;
    return cloneElement(node, {
      children: animateTextNodes(node.props.children, settings),
    });
  });
}

export default function AnimatedContent({
  children,
  fromFontVariationSettings = "'wght' 400, 'opsz' 9",
  toFontVariationSettings = "'wght' 800, 'opsz' 40",
  radius = 100,
  falloff = 'linear',
}) {
  const settings = {
    fromFontVariationSettings,
    toFontVariationSettings,
    radius,
    falloff,
  };
  return animateTextNodes(children, settings);
}
