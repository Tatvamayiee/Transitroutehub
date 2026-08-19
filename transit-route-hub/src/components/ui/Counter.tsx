import { motion } from 'framer-motion';

interface CounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function Counter({ value, prefix = '', suffix = '', className }: CounterProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      {prefix}
      <CountUp end={value} />
      {suffix}
    </motion.span>
  );
}

function CountUp({ end }: { end: number }) {
  return (
    <motion.span
      key={end}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {end.toLocaleString('en-IN')}
    </motion.span>
  );
}
