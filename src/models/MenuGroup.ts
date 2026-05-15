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
import { Menu } from "./Menu";
import { MenuItem } from "./MenuItem";

@Table({ tableName: "menu_groups" })
export class MenuGroup extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Menu)
  @Column(DataType.UUID)
  declare menuId: string;

  @BelongsTo(() => Menu)
  declare menu: Menu;

  @Column(DataType.STRING)
  declare name: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare order: number;

  @HasMany(() => MenuItem, { onDelete: "CASCADE" })
  declare items: MenuItem[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
