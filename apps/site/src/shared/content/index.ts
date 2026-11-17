import BarChart from "../blocks/BarChart/BarChart.astro";
import Callout from "../blocks/Callout/Callout.astro";
import ArticleEndnote from "../blocks/ArticleEndnote/ArticleEndnote.astro";
import Comparison from "../blocks/Comparison/Comparison.astro";
import Demo from "../../features/tools/components/Demo.astro";
import Details from "../blocks/Details/Details.astro";
import Figure from "../blocks/Figure/Figure.astro";
import Gallery from "../blocks/Gallery/Gallery.astro";
import LinkCard from "../blocks/LinkCard/LinkCard.astro";
import Steps from "../blocks/Steps/Steps.astro";
import Step from "../blocks/Step/Step.astro";
import DiagnosticList from "../blocks/DiagnosticList/DiagnosticList.astro";
import DiagnosticItem from "../blocks/DiagnosticItem/DiagnosticItem.astro";
import HistoricalReferenceLink from "../../features/discovery/components/HistoricalReferenceLink.astro";

export const contentComponents = {
  a: HistoricalReferenceLink,
  Callout,
  ArticleEndnote,
  Comparison,
  BarChart,
  Demo,
  Details,
  Figure,
  Gallery,
  LinkCard,
  Steps,
  Step,
  DiagnosticList,
  DiagnosticItem,
};
