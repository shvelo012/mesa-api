import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Restaurant } from "./Restaurant";
import { MenuPhoto } from "./MenuPhoto";
import { MenuGroup } from "./MenuGroup";

export enum MenuType {
  PHOTO = "PHOTO",
  STRUCTURED = "STRUCTURED",
}

export enum LayoutStyle {
  LIST = "LIST",
  CARD_GRID = "CARD_GRID",
  TWO_COLUMN = "TWO_COLUMN",
}

@Table({ tableName: "menus" })
export class Menu extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.ENUM("PHOTO", "STRUCTURED"))
  declare type: MenuType;

  @Column({ type: DataType.ENUM("LIST", "CARD_GRID", "TWO_COLUMN"), allowNull: true })
  declare layoutStyle: LayoutStyle | null;

  @Default(0)
  @Column(DataType.INTEGER)
  declare order: number;

  @HasMany(() => MenuPhoto, { onDelete: "CASCADE" })
  declare photos: MenuPhoto[];

  @HasMany(() => MenuGroup, { onDelete: "CASCADE" })
  declare groups: MenuGroup[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
